import { prisma } from "@/lib/db/prisma";
import { resolveBudgetOwnership } from "./authorization";
import { serializePresence } from "./serializers";
import { publishBudgetEvent } from "./events";
import { PRESENCE_HEARTBEAT_INTERVAL_MS, PRESENCE_EXPIRY_BUFFER_MS } from "./types";
import type { CollaborationPresenceRecord } from "@/types/collaboration";

type RawPresence = Parameters<typeof serializePresence>[0];

export async function upsertPresenceHeartbeat(
  budgetId: string,
  userId: string,
  route: string,
  module: string,
  status: "ACTIVE" | "IDLE" = "ACTIVE",
): Promise<CollaborationPresenceRecord> {
  const { companyId, projectId } = await resolveBudgetOwnership(budgetId, userId);

  const expiresAt = new Date(Date.now() + PRESENCE_HEARTBEAT_INTERVAL_MS + PRESENCE_EXPIRY_BUFFER_MS);

  const presence = await prisma.collaborationPresence.upsert({
    where: {
      budgetId_userId: { budgetId, userId },
    },
    update: {
      route,
      module,
      status,
      lastSeenAt: new Date(),
      expiresAt,
    },
    create: {
      companyId,
      projectId,
      budgetId,
      userId,
      route,
      module,
      status,
      lastSeenAt: new Date(),
      expiresAt,
    },
    include: {
      user: { select: { name: true, avatarUrl: true } },
    },
  });

  const record = serializePresence(presence as unknown as RawPresence);
  publishBudgetEvent(budgetId, "presence.updated", record);
  return record;
}

export async function removePresence(
  budgetId: string,
  userId: string,
): Promise<void> {
  await resolveBudgetOwnership(budgetId, userId);

  await prisma.collaborationPresence.deleteMany({
    where: { budgetId, userId },
  });

  publishBudgetEvent(budgetId, "presence.updated", { userId, active: false });
}

export async function listActivePresence(
  budgetId: string,
  userId: string,
): Promise<CollaborationPresenceRecord[]> {
  await resolveBudgetOwnership(budgetId, userId);

  const now = new Date();

  const all = await prisma.collaborationPresence.findMany({
    where: {
      budgetId,
      expiresAt: { gt: now },
    },
    include: {
      user: { select: { name: true, avatarUrl: true } },
    },
    orderBy: { lastSeenAt: "desc" },
  });

  return all.map((p) => serializePresence(p as unknown as RawPresence));
}
