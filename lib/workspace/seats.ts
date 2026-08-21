import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export class WorkspaceSeatLimitError extends Error {
  readonly code = "WORKSPACE_SEAT_LIMIT_REACHED";
  constructor(readonly used: number, readonly limit: number) {
    super(`El workspace alcanzó el límite de ${limit} asientos`);
    this.name = "WorkspaceSeatLimitError";
  }
}

type SeatClient = Pick<PrismaClient, "companyMembership" | "companySubscription" | "membershipPlan" | "user">;

export async function getWorkspaceSeatUsage(companyId: string, client: SeatClient = prisma) {
  const used = client.companyMembership.count
    ? await client.companyMembership.count({ where: { companyId, status: { in: ["ACTIVE", "INVITED"] } } })
    : 0;
  const subscription = client.companySubscription
    ? await client.companySubscription.findUnique({ where: { companyId }, select: { membershipPlan: { select: { seatLimit: true } } } })
    : null;
  if (subscription) return { used, limit: subscription.membershipPlan.seatLimit };

  const owner = client.companyMembership.findFirst
    ? await client.companyMembership.findFirst({ where: { companyId, role: "OWNER" }, select: { userId: true } })
    : null;
  const user = owner && client.user?.findUnique ? await client.user.findUnique({ where: { id: owner.userId }, select: { membershipPlan: { select: { seatLimit: true } } } }) : null;
  return { used, limit: user?.membershipPlan?.seatLimit ?? 3 };
}

export async function assertWorkspaceHasSeat(companyId: string, additionalSeats = 1, client: SeatClient = prisma) {
  const usage = await getWorkspaceSeatUsage(companyId, client);
  if (usage.limit !== null && usage.used + additionalSeats > usage.limit) {
    throw new WorkspaceSeatLimitError(usage.used, usage.limit);
  }
  return usage;
}
