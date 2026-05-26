import { prisma } from "@/lib/db/prisma";
import { getCurrentAiUsagePeriod } from "@/lib/ai/usage";

type AdminDashboardFilters = {
  plan?: string;
  role?: "ADMIN" | "USER";
  status?: "ACTIVE" | "SUSPENDED";
};

export async function getAdminDashboardStats(filters: AdminDashboardFilters = {}) {
  const periodStart = getCurrentAiUsagePeriod();
  const userWhere = {
    role: filters.role,
    status: filters.status,
    membershipPlan: filters.plan ? { slug: filters.plan } : undefined,
  };
  const [users, plans, currentUsage, actionUsage] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        aiTokenExtraMonthly: true,
        createdAt: true,
        updatedAt: true,
        companies: {
          select: { name: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        membershipPlan: {
          select: {
            name: true,
            slug: true,
            monthlyTokenLimit: true,
          },
        },
        aiUsagePeriods: {
          where: { periodStart },
          select: {
            consumedTokens: true,
            reservedTokens: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.membershipPlan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        monthlyTokenLimit: true,
        _count: {
          select: { users: true },
        },
      },
      orderBy: { monthlyTokenLimit: "asc" },
    }),
    prisma.aiUsagePeriod.aggregate({
      where: { periodStart },
      _sum: {
        consumedTokens: true,
        reservedTokens: true,
      },
    }),
    prisma.aiTokenLedger.groupBy({
      by: ["action"],
      where: {
        periodStart,
        type: "CONSUME",
      },
      _sum: {
        tokens: true,
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === "ACTIVE").length;
  const suspendedUsers = users.filter((user) => user.status === "SUSPENDED").length;
  const userRows = users.map((user) => {
    const usage = user.aiUsagePeriods[0];
    const baseLimit = user.membershipPlan?.monthlyTokenLimit ?? 0;
    const allowance = baseLimit + user.aiTokenExtraMonthly;
    const consumedTokens = usage?.consumedTokens ?? 0;
    const reservedTokens = usage?.reservedTokens ?? 0;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      companyName: user.companies[0]?.name ?? "Sin empresa",
      planName: user.membershipPlan?.name ?? "Sin plan",
      planSlug: user.membershipPlan?.slug ?? "",
      monthlyTokenLimit: baseLimit,
      aiTokenExtraMonthly: user.aiTokenExtraMonthly,
      allowance,
      consumedTokens,
      reservedTokens,
      availableTokens: Math.max(0, allowance - consumedTokens - reservedTokens),
      updatedAt: user.updatedAt,
    };
  });

  return {
    periodStart,
    metrics: {
      totalUsers,
      activeUsers,
      suspendedUsers,
      adminUsers: users.filter((user) => user.role === "ADMIN").length,
      monthlyConsumedTokens: currentUsage._sum.consumedTokens ?? 0,
      monthlyReservedTokens: currentUsage._sum.reservedTokens ?? 0,
    },
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      monthlyTokenLimit: plan.monthlyTokenLimit,
      usersCount: plan._count.users,
    })),
    usersByMembership: plans.map((plan) => ({
      label: plan.name,
      slug: plan.slug,
      count: users.filter((user) => user.membershipPlan?.slug === plan.slug).length,
    })),
    actionUsage: actionUsage.map((entry) => ({
      action: entry.action,
      requests: entry._count._all,
      tokens: entry._sum.tokens ?? 0,
    })),
    topUsers: [...userRows].sort((left, right) => right.consumedTokens - left.consumedTokens).slice(0, 5),
    users: userRows,
  };
}
