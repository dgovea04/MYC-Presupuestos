import { prisma } from "@/lib/db/prisma";
import type { AdminMarketingDateRange } from "@/lib/data/admin-marketing-analytics";

const ACTIVATION_EVENTS = new Set([
  "project_created",
  "budget_created",
  "budget_imported",
  "excel_paste_used",
  "apu_created",
  "formula_created",
  "export_completed",
]);
const ACTIVE_STATUSES = new Set(["ACTIVE", "TRIALING"]);
const MONTHLY_AMOUNT_ENV = "STRIPE_PRO_MONTHLY_AMOUNT_PEN_CENTIMOS";

type MarketingMonetizationEvent = {
  name: string;
  userId: string | null;
  isDemo: boolean | null;
};

type BillingMonetizationSubscription = {
  userId: string;
  provider: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  cancelAtPeriodEnd: boolean;
};

export type AdminMarketingMonetization = Awaited<ReturnType<typeof getAdminMarketingMonetization>>;

export async function getAdminMarketingMonetization(range: AdminMarketingDateRange) {
  try {
    const [events, subscriptions] = await Promise.all([
      prisma.marketingEvent.findMany({
        where: { occurredAt: { gte: range.from, lt: range.to } },
        select: { name: true, userId: true, isDemo: true },
      }),
      prisma.billingSubscription.findMany({
        where: {},
        select: {
          userId: true,
          provider: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          cancelAtPeriodEnd: true,
        },
      }),
    ]);

    return calculateMonetization(range, events, subscriptions);
  } catch {
    return emptyMonetization(range);
  }
}

export function calculateMonetization(
  range: AdminMarketingDateRange,
  events: readonly MarketingMonetizationEvent[],
  subscriptions: readonly BillingMonetizationSubscription[],
  monthlyAmountCents = readMonthlyAmountCents(),
) {
  const activatedUsers = new Set(
    events
      .filter((event) => ACTIVATION_EVENTS.has(event.name) && event.isDemo !== true && event.userId)
      .map((event) => event.userId)
      .filter(isPresent),
  );
  const newSubscriptions = subscriptions.filter((subscription) => isWithinRange(subscription.createdAt, range));
  const newProUsers = new Set(newSubscriptions.map((subscription) => subscription.userId));
  const activatedProUsers = [...newProUsers].filter((userId) => activatedUsers.has(userId));
  const activeSubscriptions = subscriptions.filter((subscription) => ACTIVE_STATUSES.has(subscription.status));
  const activeProUsers = new Set(activeSubscriptions.map((subscription) => subscription.userId));
  const canceledSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "CANCELED" && isWithinRange(subscription.updatedAt, range),
  );
  const pendingCancellation = activeSubscriptions.filter((subscription) => subscription.cancelAtPeriodEnd);
  const pastDueSubscriptions = subscriptions.filter((subscription) => subscription.status === "PAST_DUE");
  const cancellationBase = activeSubscriptions.length + canceledSubscriptions.length;
  const mrrCents = monthlyAmountCents === null ? null : activeSubscriptions.length * monthlyAmountCents;

  return {
    available: true,
    range: {
      from: range.from.toISOString(),
      to: new Date(range.to.getTime() - 1).toISOString(),
    },
    metrics: {
      activated: activatedUsers.size,
      newPro: newProUsers.size,
      activatedPro: activatedProUsers.length,
      activeProUsers: activeProUsers.size,
      activeSubscriptions: activeSubscriptions.length,
      newSubscriptions: newSubscriptions.length,
      canceledSubscriptions: canceledSubscriptions.length,
      pendingCancellation: pendingCancellation.length,
      pastDueSubscriptions: pastDueSubscriptions.length,
    },
    rates: {
      activatedToProRate: percentage(activatedProUsers.length, activatedUsers.size),
      observedCancellationRate: percentage(canceledSubscriptions.length, cancellationBase),
    },
    mrr: mrrCents === null ? null : { cents: mrrCents, currency: "PEN" as const },
    mrrConfigured: monthlyAmountCents !== null,
    mrrNote: monthlyAmountCents === null
      ? `Configura ${MONTHLY_AMOUNT_ENV} con el importe mensual verificado en centimos de PEN.`
      : "MRR = suscripciones activas o en prueba × importe mensual configurado.",
  };
}

function emptyMonetization(range: AdminMarketingDateRange) {
  return {
    available: false,
    range: {
      from: range.from.toISOString(),
      to: new Date(range.to.getTime() - 1).toISOString(),
    },
    metrics: {
      activated: 0,
      newPro: 0,
      activatedPro: 0,
      activeProUsers: 0,
      activeSubscriptions: 0,
      newSubscriptions: 0,
      canceledSubscriptions: 0,
      pendingCancellation: 0,
      pastDueSubscriptions: 0,
    },
    rates: { activatedToProRate: 0, observedCancellationRate: 0 },
    mrr: null,
    mrrConfigured: false,
    mrrNote: "El almacenamiento de monetizacion no esta disponible.",
  };
}

function readMonthlyAmountCents() {
  const rawValue = process.env[MONTHLY_AMOUNT_ENV];
  if (!rawValue || !/^\d+$/.test(rawValue)) {
    return null;
  }

  const value = Number(rawValue);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function isWithinRange(value: Date, range: AdminMarketingDateRange) {
  return value >= range.from && value < range.to;
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function isPresent(value: string | null | undefined): value is string {
  return Boolean(value);
}
