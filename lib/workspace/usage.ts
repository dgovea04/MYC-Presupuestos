import type { MembershipPlan, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type UsageClient = Pick<
  PrismaClient,
  "companySubscription" | "membershipPlan" | "user" | "companyMembership" | "project" | "budget"
>;

export type WorkspacePlanSummary = {
  slug: string;
  name: string;
  billingMode: string;
  monthlyTokenLimit: number;
  seatLimit: number | null;
  projectLimit: number | null;
  budgetLimit: number | null;
  entitlements: string[];
};

export type WorkspaceUsageMetric = {
  count: number;
  window: "actual";
  source: "company_memberships" | "projects" | "budgets";
};

export type WorkspaceUsage = {
  plan: WorkspacePlanSummary | null;
  subscription: {
    provider: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    pastDueStartedAt: string | null;
    externalCustomerId: string | null;
    externalSubscriptionId: string | null;
    syncedAt: string | null;
    needsSync: boolean;
  } | null;
  seats: { used: number; limit: number | null };
  metrics: {
    members: WorkspaceUsageMetric;
    projects: WorkspaceUsageMetric;
    budgets: WorkspaceUsageMetric;
  };
};

function toPlanSummary(plan: MembershipPlan): WorkspacePlanSummary {
  return {
    slug: plan.slug,
    name: plan.name,
    billingMode: plan.billingMode,
    monthlyTokenLimit: plan.monthlyTokenLimit,
    seatLimit: plan.seatLimit,
    projectLimit: plan.projectLimit,
    budgetLimit: plan.budgetLimit,
    entitlements: plan.entitlements,
  };
}

/**
 * Lectura del estado comercial del workspace: plan efectivo, suscripción,
 * asientos y métricas de uso. Todo scoped a `companyId`; no escribe ni sincroniza.
 */
export async function getWorkspaceUsage(companyId: string, client: UsageClient = prisma): Promise<WorkspaceUsage> {
  const subscription = await client.companySubscription.findUnique({
    where: { companyId },
    include: { membershipPlan: true },
  });

  let plan = subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIALING")
    ? subscription.membershipPlan
    : null;

  // Fallback: plan personal del Owner cuando el workspace aún no tiene suscripción.
  if (!plan) {
    const owner = await client.companyMembership.findFirst({
      where: { companyId, role: "OWNER" },
      select: { userId: true },
    });
    const ownerUser = owner
      ? await client.user.findUnique({
          where: { id: owner.userId },
          include: { membershipPlan: true },
        })
      : null;
    plan = ownerUser?.membershipPlan ?? null;
  }

  const [usedSeats, projectCount, budgetCount] = await Promise.all([
    client.companyMembership.count({ where: { companyId, status: { in: ["ACTIVE", "INVITED"] } } }),
    client.project.count({ where: { companyId } }),
    client.budget.count({ where: { project: { companyId } } }),
  ]);
  const seats = { used: usedSeats, limit: plan?.seatLimit ?? 3 };

  return {
    plan: plan ? toPlanSummary(plan) : null,
    subscription: subscription
      ? {
          provider: subscription.provider,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          pastDueStartedAt: subscription.pastDueStartedAt?.toISOString() ?? null,
          externalCustomerId: subscription.externalCustomerId,
          externalSubscriptionId: subscription.externalSubscriptionId,
          syncedAt: subscription.updatedAt.toISOString(),
          needsSync: subscription.provider === "STRIPE" && !subscription.externalSubscriptionId,
        }
      : null,
    seats,
    metrics: {
      members: { count: seats.used, window: "actual", source: "company_memberships" },
      projects: { count: projectCount, window: "actual", source: "projects" },
      budgets: { count: budgetCount, window: "actual", source: "budgets" },
    },
  };
}
