import { prisma } from "@/lib/db/prisma";
import type { AdminMarketingDateRange } from "@/lib/data/admin-marketing-analytics";
import { getGa4MarketingReport } from "@/lib/analytics/ga4-data-api";

type ReconciliationStatus = "match" | "review";

export type MarketingReconciliationRow = {
  key: string;
  label: string;
  source: string;
  internalCount: number;
  sourceCount: number;
  difference: number;
  matchRate: number;
  status: ReconciliationStatus;
};

export type AdminMarketingReconciliation = Awaited<ReturnType<typeof getAdminMarketingReconciliation>>;

export async function getAdminMarketingReconciliation(range: AdminMarketingDateRange) {
  try {
    const [events, registrations, projects, budgets, subscriptions, ga4] = await Promise.all([
      prisma.marketingEvent.findMany({
        where: { occurredAt: { gte: range.from, lt: range.to } },
        select: {
          id: true,
          name: true,
          userId: true,
          clientId: true,
          projectId: true,
          budgetId: true,
          isDemo: true,
        },
      }),
      prisma.user.count({ where: { createdAt: { gte: range.from, lt: range.to } } }),
      prisma.project.count({ where: { createdAt: { gte: range.from, lt: range.to }, isDemo: false } }),
      prisma.budget.count({
        where: {
          createdAt: { gte: range.from, lt: range.to },
          project: { isDemo: false },
        },
      }),
      prisma.billingSubscription.count({
        where: {
          createdAt: { gte: range.from, lt: range.to },
          status: { in: ["ACTIVE", "TRIALING"] },
        },
      }),
      getGa4MarketingReport(range),
    ]);

    const rows = [
      createRow(
        "signup_completed",
        "Registros",
        "User.createdAt",
        uniqueCount(events.filter((event) => event.name === "signup_completed").map(getIdentity)),
        registrations,
      ),
      createRow(
        "project_created",
        "Proyectos reales",
        "Project.createdAt",
        uniqueCount(
          events
            .filter((event) => event.name === "project_created" && event.isDemo !== true)
            .map((event) => event.projectId ?? event.id),
        ),
        projects,
      ),
      createRow(
        "budget_created",
        "Presupuestos reales",
        "Budget.createdAt",
        uniqueCount(
          events
            .filter((event) => event.name === "budget_created" && event.isDemo !== true)
            .map((event) => event.budgetId ?? event.id),
        ),
        budgets,
      ),
      createRow(
        "subscription_created",
        "Pro nuevos",
        "BillingSubscription.createdAt",
        uniqueCount(events.filter((event) => event.name === "subscription_created").map(getIdentity)),
        subscriptions,
      ),
    ];

    return {
      available: true,
      checkedAt: new Date().toISOString(),
      rows,
      ga4,
    };
  } catch {
    return {
      available: false,
      checkedAt: new Date().toISOString(),
      rows: [] as MarketingReconciliationRow[],
      ga4: { available: false as const, reason: "No se pudo consultar GA4." },
    };
  }
}

function createRow(
  key: string,
  label: string,
  source: string,
  internalCount: number,
  sourceCount: number,
): MarketingReconciliationRow {
  return {
    key,
    label,
    source,
    internalCount,
    sourceCount,
    difference: internalCount - sourceCount,
    matchRate: sourceCount > 0 ? Math.round((internalCount / sourceCount) * 1000) / 10 : internalCount === 0 ? 100 : 0,
    status: internalCount === sourceCount ? "match" : "review",
  };
}

function getIdentity(event: { id: string; userId: string | null; clientId: string | null }) {
  return event.userId ?? event.clientId ?? `event:${event.id}`;
}

function uniqueCount(values: readonly string[]) {
  return new Set(values).size;
}
