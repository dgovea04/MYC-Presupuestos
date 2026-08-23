import { prisma } from "@/lib/db/prisma";
import { getCurrentAiUsagePeriod } from "@/lib/ai/usage";
import { ensureDate } from "@/lib/utils";
import { PRO_FOUNDER_OFFER_CODE } from "@/lib/billing/pricing";

export type AdminDashboardFilters = {
  plan?: string;
  role?: "ADMIN" | "USER";
  status?: "ACTIVE" | "SUSPENDED";
  query?: string;
  page?: number;
};

export const ADMIN_USERS_PAGE_SIZE = 25;

export function normalizeAdminUserQuery(value?: string) {
  const normalized = value?.trim().slice(0, 100);
  return normalized || undefined;
}

export function normalizeAdminUserPage(value?: number) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

export async function getAdminDashboardStats(filters: AdminDashboardFilters = {}) {
  const periodStart = getCurrentAiUsagePeriod();
  const requestedPage = normalizeAdminUserPage(filters.page);
  const query = normalizeAdminUserQuery(filters.query);
  const userWhere = {
    role: filters.role,
    status: filters.status,
    membershipPlan: filters.plan ? { slug: filters.plan } : undefined,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const activeUserWhere = { ...userWhere, status: "ACTIVE" as const };
  const suspendedUserWhere = { ...userWhere, status: "SUSPENDED" as const };
  const totalUsers = await prisma.user.count({ where: userWhere });
  const totalPages = Math.max(1, Math.ceil(totalUsers / ADMIN_USERS_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const [users, activeUsers, suspendedUsers, adminUsers, plans, currentUsage, actionUsage, manualPaymentRequests, workspacePaymentRequests] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
        role: true,
        adminProfile: true,
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
            billingMode: true,
            monthlyTokenLimit: true,
          },
        },
        billingSubscriptions: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            provider: true,
            status: true,
            currentPeriodEnd: true,
            pastDueStartedAt: true,
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
      skip: (page - 1) * ADMIN_USERS_PAGE_SIZE,
      take: ADMIN_USERS_PAGE_SIZE,
    }),
    prisma.user.count({ where: activeUserWhere }),
    prisma.user.count({ where: suspendedUserWhere }),
    prisma.user.count({ where: { ...userWhere, role: "ADMIN" as const } }),
    prisma.membershipPlan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        billingMode: true,
        projectLimit: true,
        budgetLimit: true,
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
    prisma.billingSubscription.findMany({
      where: {
        provider: "MANUAL",
        status: "INCOMPLETE",
      },
      select: {
        id: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            membershipPlan: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.companySubscription.findMany({
      where: {
        provider: "MANUAL",
        status: "INCOMPLETE",
      },
      select: {
        id: true,
        companyId: true,
        createdAt: true,
        receiptUrl: true,
        company: {
          select: {
            name: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                membershipPlan: {
                  select: { name: true, slug: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const userRows = users.map((user) => {
    const usage = user.aiUsagePeriods[0];
    const baseLimit = user.membershipPlan?.monthlyTokenLimit ?? 0;
    const allowance = baseLimit + user.aiTokenExtraMonthly;
    const consumedTokens = usage?.consumedTokens ?? 0;
    const reservedTokens = usage?.reservedTokens ?? 0;
    const billingSubscription = user.billingSubscriptions[0] ?? null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt ? ensureDate(user.emailVerifiedAt).toISOString() : null,
      role: user.role,
      adminProfile: user.adminProfile,
      status: user.status,
      companyName: user.companies[0]?.name ?? "Sin empresa",
      planName: user.membershipPlan?.name ?? "Sin plan",
      planSlug: user.membershipPlan?.slug ?? "",
      billingMode: user.membershipPlan?.billingMode ?? "FREE",
      billingProvider: billingSubscription?.provider ?? null,
      billingStatus: billingSubscription?.status ?? null,
      currentPeriodEnd: billingSubscription?.currentPeriodEnd ? ensureDate(billingSubscription.currentPeriodEnd).toISOString() : null,
      graceEndsAt:
        billingSubscription?.status === "PAST_DUE" && billingSubscription.pastDueStartedAt
          ? new Date(ensureDate(billingSubscription.pastDueStartedAt).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
          : null,
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
      adminUsers,
      monthlyConsumedTokens: currentUsage._sum.consumedTokens ?? 0,
      monthlyReservedTokens: currentUsage._sum.reservedTokens ?? 0,
    },
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      billingMode: plan.billingMode,
      projectLimit: plan.projectLimit,
      budgetLimit: plan.budgetLimit,
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
    pagination: {
      page,
      pageSize: ADMIN_USERS_PAGE_SIZE,
      totalUsers,
      totalPages,
      query: query ?? "",
    },
    manualPaymentRequests: [
      ...manualPaymentRequests.map((request) => ({
        id: request.id,
        createdAt: ensureDate(request.createdAt).toISOString(),
        userId: request.user.id,
        userName: request.user.name,
        userEmail: request.user.email,
        currentPlanName: request.user.membershipPlan?.name ?? "Sin plan",
        currentPlanSlug: request.user.membershipPlan?.slug ?? "",
        workspaceName: null,
        receiptUrl: null,
        offerCode: PRO_FOUNDER_OFFER_CODE,
      })),
      ...workspacePaymentRequests.map((request) => ({
        id: request.id,
        createdAt: ensureDate(request.createdAt).toISOString(),
        userId: request.company.user.id,
        userName: request.company.user.name,
        userEmail: request.company.user.email,
        currentPlanName: request.company.user.membershipPlan?.name ?? "Sin plan",
        currentPlanSlug: request.company.user.membershipPlan?.slug ?? "",
        workspaceName: request.company.name,
        receiptUrl: request.receiptUrl ?? null,
        offerCode: PRO_FOUNDER_OFFER_CODE,
      })),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 20),
  };
}
