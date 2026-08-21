import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export { formatRelativeLastActive, type RelativeLastActive } from "@/lib/workspace/activity-format";

const DEFAULT_THROTTLE_MS = 15 * 60 * 1000; // 15 minutos

type ActivityClient = Pick<PrismaClient, "companyMembership">;

/**
 * Actualiza `lastActiveAt` solo si la última marca es anterior a la ventana de
 * throttling. Devuelve `true` si se escribió un nuevo valor. Nunca debe usarse
 * como señal de presencia en tiempo real.
 */
export async function touchWorkspaceMembershipActivity(options: {
  userId: string;
  companyId: string;
  now?: Date;
  throttleMs?: number;
  client?: ActivityClient;
}): Promise<boolean> {
  const client = options.client ?? prisma;
  const now = options.now ?? new Date();
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;

  const membership = await client.companyMembership.findUnique({
    where: { companyId_userId: { companyId: options.companyId, userId: options.userId } },
    select: { status: true, lastActiveAt: true },
  });

  if (!membership || membership.status !== "ACTIVE") return false;

  if (membership.lastActiveAt && now.getTime() - membership.lastActiveAt.getTime() < throttleMs) {
    return false;
  }

  await client.companyMembership.update({
    where: { companyId_userId: { companyId: options.companyId, userId: options.userId } },
    data: { lastActiveAt: now },
  });

  return true;
}
