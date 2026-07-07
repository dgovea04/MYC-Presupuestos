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

export async function startEditSession(
  budgetId: string,
  userId: string,
  input: EditSessionStartInput,
): Promise<CollaborationEditSessionRecord> {
  const { companyId, projectId } = await resolveBudgetOwnership(budgetId, userId);
  const parsed = editSessionStartSchema.parse(input);

  const expiresAt = new Date(Date.now() + EDIT_SESSION_HEARTBEAT_INTERVAL_MS + EDIT_SESSION_EXPIRY_BUFFER_MS);

  const session = await prisma.collaborationEditSession.create({
    data: {
      companyId,
      projectId,
      budgetId,
      userId,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      field: parsed.field,
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
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

  const session = await prisma.collaborationEditSession.update({
    where: { id: sessionId, budgetId },
    data: {
      lastHeartbeatAt: new Date(),
      expiresAt,
    },
    include: {
      user: { select: { name: true } },
    },
  });

  const record = serializeEditSession(session as unknown as RawSession);
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
