import { prisma } from "@/lib/db/prisma";
import { resolveBudgetOwnership } from "./authorization";
import { serializeEditSession } from "./serializers";
import { publishBudgetEvent } from "./events";
import { EDIT_SESSION_HEARTBEAT_INTERVAL_MS, EDIT_SESSION_EXPIRY_BUFFER_MS } from "./types";
import {
  editSessionStartSchema,
  type EditSessionStartInput,
} from "@/lib/validations/collaboration";
import type { CollaborationEditSessionRecord } from "@/types/collaboration";

type RawSession = Parameters<typeof serializeEditSession>[0];
export type EditSessionResult = { status: "CLAIMED" | "CONFLICT" | "EXPIRED_REPLACED"; session: CollaborationEditSessionRecord | null };

export async function claimEditSession(input: { budgetId: string; userId: string; entityType: EditSessionStartInput["entityType"]; entityId: string; field: string }): Promise<EditSessionResult> {
  const { companyId, projectId } = await resolveBudgetOwnership(input.budgetId, input.userId);
  const parsed = editSessionStartSchema.parse({ entityType: input.entityType, entityId: input.entityId, field: input.field });
  const now = new Date();
  const existing = await prisma.collaborationEditSession.findFirst({ where: { budgetId: input.budgetId, entityType: parsed.entityType, entityId: parsed.entityId, field: parsed.field }, include: { user: { select: { name: true } } } });
  if (existing && existing.expiresAt > now && existing.userId !== input.userId) return { status: "CONFLICT", session: serializeEditSession(existing as unknown as RawSession) };
  const expiresAt = new Date(now.getTime() + EDIT_SESSION_HEARTBEAT_INTERVAL_MS + EDIT_SESSION_EXPIRY_BUFFER_MS);
  if (existing) await prisma.collaborationEditSession.delete({ where: { id: existing.id } });
  const created = await prisma.collaborationEditSession.create({ data: { companyId, projectId, budgetId: input.budgetId, userId: input.userId, entityType: parsed.entityType, entityId: parsed.entityId, field: parsed.field, startedAt: now, lastHeartbeatAt: now, expiresAt }, include: { user: { select: { name: true } } } });
  const result = serializeEditSession(created as unknown as RawSession);
  publishBudgetEvent(input.budgetId, "edit-session.started", result);
  return { status: existing ? "EXPIRED_REPLACED" : "CLAIMED", session: result };
}

export async function startEditSession(
  budgetId: string,
  userId: string,
  input: EditSessionStartInput,
): Promise<CollaborationEditSessionRecord> {
  const { companyId, projectId } = await resolveBudgetOwnership(budgetId, userId);
  const parsed = editSessionStartSchema.parse(input);

  const now = new Date();
  await prisma.collaborationEditSession.deleteMany({ where: { budgetId, entityType: parsed.entityType, entityId: parsed.entityId, field: parsed.field, expiresAt: { lte: now } } });
  const active = await prisma.collaborationEditSession.findFirst({ where: { budgetId, entityType: parsed.entityType, entityId: parsed.entityId, field: parsed.field, expiresAt: { gt: now } }, select: { id: true, userId: true } });
  if (active && active.userId !== userId) throw new Error("EDIT_SESSION_CONFLICT");
  if (active) return heartbeatEditSession(active.id, budgetId, userId);
  const expiresAt = new Date(now.getTime() + EDIT_SESSION_HEARTBEAT_INTERVAL_MS + EDIT_SESSION_EXPIRY_BUFFER_MS);

  const session = await prisma.collaborationEditSession.create({
    data: {
      companyId,
      projectId,
      budgetId,
      userId,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      field: parsed.field,
      startedAt: now,
      lastHeartbeatAt: now,
      expiresAt,
    },
    include: {
      user: { select: { name: true } },
    },
  });

  const record = serializeEditSession(session as unknown as RawSession);
  publishBudgetEvent(budgetId, "edit-session.started", record);
  return record;
}

export async function heartbeatEditSession(
  sessionId: string,
  budgetId: string,
  userId: string,
): Promise<CollaborationEditSessionRecord> {
  await resolveBudgetOwnership(budgetId, userId);

  const expiresAt = new Date(Date.now() + EDIT_SESSION_HEARTBEAT_INTERVAL_MS + EDIT_SESSION_EXPIRY_BUFFER_MS);

  const session = await prisma.collaborationEditSession.findFirst({
    where: { id: sessionId, budgetId, userId, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!session) throw new Error("EDIT_SESSION_NOT_FOUND_OR_EXPIRED");
  const updated = await prisma.collaborationEditSession.update({
    where: { id: session.id },
    data: {
      lastHeartbeatAt: new Date(),
      expiresAt,
    },
    include: {
      user: { select: { name: true } },
    },
  });

  const record = serializeEditSession(updated as unknown as RawSession);
  publishBudgetEvent(budgetId, "edit-session.heartbeat", record);
  return record;
}

export async function finishEditSession(
  sessionId: string,
  budgetId: string,
  userId: string,
): Promise<void> {
  await resolveBudgetOwnership(budgetId, userId);

  const session = await prisma.collaborationEditSession.findFirst({
    where: { id: sessionId, budgetId },
    select: { id: true, entityType: true, entityId: true, userId: true },
  });

  if (!session) return;

  await prisma.collaborationEditSession.delete({
    where: { id: sessionId },
  });

  publishBudgetEvent(budgetId, "edit-session.finished", {
    userId: session.userId,
    entityType: session.entityType,
    entityId: session.entityId,
  });
}

export async function expireStaleSessions(budgetId: string): Promise<number> {
  const now = new Date();

  const result = await prisma.collaborationEditSession.deleteMany({
    where: {
      budgetId,
      expiresAt: { lt: now },
    },
  });

  return result.count;
}
