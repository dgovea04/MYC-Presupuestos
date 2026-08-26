import type { MembershipPlan, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getScopedUsagePeriod } from "@/lib/ai/usage-scope";

type UsageClient = Pick<
  PrismaClient,
  "companySubscription" | "membershipPlan" | "user" | "companyMembership" | "project" | "budget"
> & Partial<Pick<PrismaClient, "aiTokenLedger">>;

export type WorkspacePlanSummary = {
  slug: string;
  name: string;
  billingMode: string;
  monthlyTokenLimit: number;
  workspaceAiTokenLimit: number | null;
  monthlyBudgetMinor: number | null;
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

export type WorkspaceAiUsage = {
  periodStart: string;
  requests: number;
  consumedTokens: number;
  actualCostMinor: number;
  estimatedCostMinor: number;
  limit: number | null;
  availableTokens: number | null;
};

export type WorkspaceUsage = {
  plan: WorkspacePlanSummary | null;
  aiUsage: WorkspaceAiUsage;
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
    workspaceAiTokenLimit: plan.workspaceAiTokenLimit,
    monthlyBudgetMinor: plan.monthlyBudgetMinor,
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

  const periodStart = getScopedUsagePeriod();
  const [usedSeats, projectCount, budgetCount, aiUsageAggregate] = await Promise.all([
    client.companyMembership.count({ where: { companyId, status: { in: ["ACTIVE", "INVITED"] } } }),
    client.project.count({ where: { companyId } }),
    client.budget.count({ where: { project: { companyId } } }),
    client.aiTokenLedger
      ? client.aiTokenLedger.aggregate({
          where: { workspaceId: companyId, type: "CONSUME", createdAt: { gte: periodStart } },
          _count: { _all: true },
          _sum: { tokens: true, actualCostMinor: true, estimatedCostMinor: true },
        })
      : null,
  ]);
  const seats = { used: usedSeats, limit: plan?.seatLimit ?? 3 };

  const aiLimit = plan?.workspaceAiTokenLimit ?? plan?.monthlyTokenLimit ?? null;
  const consumedAiTokens = aiUsageAggregate?._sum.tokens ?? 0;

  return {
    plan: plan ? toPlanSummary(plan) : null,
    aiUsage: {
      periodStart: periodStart.toISOString(),
      requests: aiUsageAggregate?._count._all ?? 0,
      consumedTokens: consumedAiTokens,
      actualCostMinor: aiUsageAggregate?._sum.actualCostMinor ?? 0,
      estimatedCostMinor: aiUsageAggregate?._sum.estimatedCostMinor ?? 0,
      limit: aiLimit,
      availableTokens: aiLimit === null ? null : Math.max(0, aiLimit - consumedAiTokens),
    },
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
