import { cache } from "react";
import { unstable_cache } from "next/cache";
import { decimalToNumber } from "@/lib/db/serializers";
import { prisma } from "@/lib/db/prisma";
import { ensureDate } from "@/lib/utils";

export const DASHBOARD_ANALYTICS_CACHE_TAG = "dashboard-analytics";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubBudgetBreakdown = {
  subBudgetName: string;
  totalDirectCost: number;
  totalAmount: number;
  currency: string;
};

export type CostByPhaseItem = {
  projectId: string;
  projectName: string;
  generalBudgetId: string;
  generalTotal: number;
  currency: string;
  subBudgets: SubBudgetBreakdown[];
};

export type BudgetComparisonItem = {
  projectId: string;
  projectName: string;
  budgetId: string;
  totalAmount: number;
  totalDirectCost: number;
  currency: string;
  updatedAt: Date;
};

export type CostTrendPoint = {
  period: string; // "YYYY-MM"
  label: string;
  kValue: number;
  projectName: string;
  budgetName: string;
};

export type DeviationAlert = {
  id: string;
  projectName: string;
  budgetName: string;
  href: string;
  originalAmount: number;
  adjustedAmount: number;
  deviationAmount: number;
  deviationPercent: number;
  period: string;
  severity: "high" | "medium" | "low";
  currency: string;
};

// ─── Analytics queries ────────────────────────────────────────────────────────

const _getCostByPhaseAnalytics = async (userId: string, activeCompanyId?: string | null): Promise<CostByPhaseItem[]> => {
  const projects = await prisma.project.findMany({
    where: {
      companyId: activeCompanyId ?? undefined,
      company: {
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      budgets: {
        where: { kind: "GENERAL" },
        select: {
          id: true,
          currency: true,
          totalAmount: true,
          childBudgets: {
            where: { kind: "SUB_BUDGET" },
            select: {
              name: true,
              totalDirectCost: true,
              totalAmount: true,
              currency: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return projects
    .filter((project) => project.budgets.length > 0)
    .map((project) => {
      const general = project.budgets[0];
      return {
        projectId: project.id,
        projectName: project.name,
        generalBudgetId: general.id,
        generalTotal: decimalToNumber(general.totalAmount),
        currency: general.currency,
        subBudgets: general.childBudgets.map((child) => ({
          subBudgetName: child.name,
          totalDirectCost: decimalToNumber(child.totalDirectCost),
          totalAmount: decimalToNumber(child.totalAmount),
          currency: child.currency,
        })),
      };
    });
}

const _getBudgetComparison = async (userId: string, activeCompanyId?: string | null): Promise<BudgetComparisonItem[]> => {
  const budgets = await prisma.budget.findMany({
    where: {
      kind: "GENERAL",
      project: {
        companyId: activeCompanyId ?? undefined,
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      currency: true,
      totalAmount: true,
      totalDirectCost: true,
      updatedAt: true,
      projectId: true,
      project: {
        select: { name: true },
      },
    },
    orderBy: { totalAmount: "desc" },
  });

  return budgets.map((budget) => ({
    projectId: budget.projectId,
    projectName: budget.project.name,
    budgetId: budget.id,
    totalAmount: decimalToNumber(budget.totalAmount),
    totalDirectCost: decimalToNumber(budget.totalDirectCost),
    currency: budget.currency,
    updatedAt: budget.updatedAt,
  }));
}

const _getCostTrends = async (userId: string, activeCompanyId?: string | null): Promise<CostTrendPoint[]> => {
  const formulas = await prisma.polynomialFormula.findMany({
    where: {
      project: {
        companyId: activeCompanyId ?? undefined,
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      project: {
        select: { name: true },
      },
      adjustments: {
        select: {
          month: true,
          year: true,
          kRounded: true,
        },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      },
    },
  });

  const points: CostTrendPoint[] = [];

  for (const formula of formulas) {
    for (const adj of formula.adjustments) {
      const kValue = decimalToNumber(adj.kRounded);
      if (kValue === 0) continue;

      const monthStr = String(adj.month).padStart(2, "0");
      points.push({
        period: `${adj.year}-${monthStr}`,
        label: `${monthStr}/${adj.year}`,
        kValue,
        projectName: formula.project.name,
        budgetName: formula.name,
      });
    }
  }

  return points.sort((a, b) => a.period.localeCompare(b.period));
}

const _getDeviationAlerts = async (userId: string, activeCompanyId?: string | null): Promise<DeviationAlert[]> => {
  const formulas = await prisma.polynomialFormula.findMany({
    where: {
      project: {
        companyId: activeCompanyId ?? undefined,
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      totalBaseAmount: true,
      budgetId: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      adjustments: {
        select: {
          id: true,
          month: true,
          year: true,
          originalAmount: true,
          adjustedAmount: true,
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      },
    },
  });

  const alerts: DeviationAlert[] = [];

  for (const formula of formulas) {
    // Take only the latest adjustment per formula
    const latestAdjustment = formula.adjustments[0];
    if (!latestAdjustment) continue;

    const originalAmount = decimalToNumber(latestAdjustment.originalAmount);
    const adjustedAmount = decimalToNumber(latestAdjustment.adjustedAmount);
    const deviationAmount = Math.abs(adjustedAmount - originalAmount);
    const deviationPercent =
      originalAmount > 0 ? (deviationAmount / originalAmount) * 100 : 0;

    if (deviationAmount < 1) continue; // Skip negligible deviations

    const severity: DeviationAlert["severity"] =
      deviationPercent > 15 ? "high" : deviationPercent > 7 ? "medium" : "low";

    alerts.push({
      id: latestAdjustment.id,
      projectName: formula.project.name,
      budgetName: formula.name,
      href: `/budgets/${formula.budgetId}/polynomial-formula?focus=adjustment`,
      originalAmount,
      adjustedAmount,
      deviationAmount,
      deviationPercent: Math.round(deviationPercent * 10) / 10,
      period: `${latestAdjustment.month}/${latestAdjustment.year}`,
      severity,
      currency: "PEN",
    });
  }

  return alerts.sort((a, b) => b.deviationPercent - a.deviationPercent);
}

// ─── Cached exports ──────────────────────────────────────────────────────────

function normalizeBudgetComparisonDates(items: BudgetComparisonItem[]): BudgetComparisonItem[] {
  return items.map((item) => ({
    ...item,
    updatedAt: ensureDate(item.updatedAt),
  }));
}

export const getCostByPhaseAnalytics = cache(
  async (userId: string, activeCompanyId?: string | null) => {
    return unstable_cache(
      async (uid: string) => _getCostByPhaseAnalytics(uid, activeCompanyId),
      activeCompanyId
        ? ["dashboard-analytics-cost-by-phase", activeCompanyId]
        : ["dashboard-analytics-cost-by-phase"],
      { tags: [DASHBOARD_ANALYTICS_CACHE_TAG] },
    )(userId);
  },
);

export const getBudgetComparison = cache(
  async (userId: string, activeCompanyId?: string | null) => {
    const result = await unstable_cache(
      async (uid: string) => _getBudgetComparison(uid, activeCompanyId),
      activeCompanyId
        ? ["dashboard-analytics-budget-comparison", activeCompanyId]
        : ["dashboard-analytics-budget-comparison"],
      { tags: [DASHBOARD_ANALYTICS_CACHE_TAG] },
    )(userId);
    return normalizeBudgetComparisonDates(result);
  },
);

export const getCostTrends = cache(
  async (userId: string, activeCompanyId?: string | null) => {
    return unstable_cache(
      async (uid: string) => _getCostTrends(uid, activeCompanyId),
      activeCompanyId
        ? ["dashboard-analytics-cost-trends", activeCompanyId]
        : ["dashboard-analytics-cost-trends"],
      { tags: [DASHBOARD_ANALYTICS_CACHE_TAG] },
    )(userId);
  },
);

export const getDeviationAlerts = cache(
  async (userId: string, activeCompanyId?: string | null) => {
    return unstable_cache(
      async (uid: string) => _getDeviationAlerts(uid, activeCompanyId),
      activeCompanyId
        ? ["dashboard-analytics-deviation-alerts", activeCompanyId]
        : ["dashboard-analytics-deviation-alerts"],
      { tags: [DASHBOARD_ANALYTICS_CACHE_TAG] },
    )(userId);
  },
);
