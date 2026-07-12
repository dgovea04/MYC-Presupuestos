import { prisma } from "@/lib/db/prisma";
import { resolveBudgetOwnership } from "./authorization";
import { serializePresence } from "./serializers";
import { publishBudgetEvent } from "./events";
import { PRESENCE_HEARTBEAT_INTERVAL_MS, PRESENCE_EXPIRY_BUFFER_MS } from "./types";
import type { CollaborationPresenceRecord } from "@/types/collaboration";

type RawPresence = Parameters<typeof serializePresence>[0];
type BudgetOwnership = Awaited<ReturnType<typeof resolveBudgetOwnership>>;

const PRESENCE_OWNERSHIP_CACHE_TTL_MS = 5_000;
const shouldUsePresenceOwnershipCache = process.env.VITEST !== "true";
const presenceOwnershipCache = new Map<string, { expiresAt: number; value: Promise<BudgetOwnership> }>();

function getPresenceOwnership(budgetId: string, userId: string) {
  if (!shouldUsePresenceOwnershipCache) {
    return resolveBudgetOwnership(budgetId, userId);
  }

  const key = `${budgetId}:${userId}`;
  const existing = presenceOwnershipCache.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.value;
  }

  const value = resolveBudgetOwnership(budgetId, userId).catch((error: unknown) => {
    presenceOwnershipCache.delete(key);
    throw error;
  });

  presenceOwnershipCache.set(key, {
    expiresAt: Date.now() + PRESENCE_OWNERSHIP_CACHE_TTL_MS,
    value,
  });

  return value;
}

export async function upsertPresenceHeartbeat(
  budgetId: string,
  userId: string,
  route: string,
  module: string,
  status: "ACTIVE" | "IDLE" = "ACTIVE",
): Promise<CollaborationPresenceRecord> {
  const { companyId, projectId } = await getPresenceOwnership(budgetId, userId);

  const lastSeenAt = new Date();
  const expiresAt = new Date(Date.now() + PRESENCE_HEARTBEAT_INTERVAL_MS + PRESENCE_EXPIRY_BUFFER_MS);

  const update = {
    route,
    module,
    status,
    lastSeenAt,
    expiresAt,
  };
  const include = {
    user: { select: { name: true, avatarUrl: true } },
  };

  const existing = await prisma.collaborationPresence.updateMany({
    where: { budgetId, userId },
    data: update,
  });

  if (existing.count === 0) {
    await prisma.collaborationPresence.createMany({
      data: {
        companyId,
        projectId,
        budgetId,
        userId,
        ...update,
      },
      skipDuplicates: true,
    });
  }

  const presence = await prisma.collaborationPresence.findUnique({
    where: {
      budgetId_userId: { budgetId, userId },
    },
    include,
  });

  if (!presence) {
    throw new Error("No se pudo registrar la presencia colaborativa");
  }

  const record = serializePresence(presence as unknown as RawPresence);
  publishBudgetEvent(budgetId, "presence.updated", record);
  return record;
}

export async function removePresence(
  budgetId: string,
  userId: string,
): Promise<void> {
  await getPresenceOwnership(budgetId, userId);

  await prisma.collaborationPresence.deleteMany({
    where: { budgetId, userId },
  });

  publishBudgetEvent(budgetId, "presence.updated", { userId, active: false });
}

export async function listActivePresence(
  budgetId: string,
  userId: string,
): Promise<CollaborationPresenceRecord[]> {
  await getPresenceOwnership(budgetId, userId);

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
