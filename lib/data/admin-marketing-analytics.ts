import { prisma } from "@/lib/db/prisma";

const ACTIVATION_EVENTS = new Set([
  "project_created",
  "budget_created",
  "budget_imported",
  "excel_paste_used",
  "apu_created",
  "formula_created",
  "export_completed",
]);

const ENGAGEMENT_EVENTS = new Set([...ACTIVATION_EVENTS, "khipu_used"]);
const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 90;

export type AdminMarketingDateRange = {
  from: Date;
  to: Date;
};

export type AdminMarketingAnalytics = Awaited<ReturnType<typeof getAdminMarketingAnalytics>>;

export function normalizeAdminMarketingDateRange(fromValue?: string, toValue?: string, now = new Date()): AdminMarketingDateRange {
  const defaultTo = startOfUtcDay(now);
  const defaultFrom = addUtcDays(defaultTo, -(DEFAULT_RANGE_DAYS - 1));
  const parsedFrom = parseDateInput(fromValue);
  const parsedTo = parseDateInput(toValue);
  let from = parsedFrom ?? defaultFrom;
  let to = parsedTo ? addUtcDays(parsedTo, 1) : addUtcDays(defaultTo, 1);

  if (from >= to) {
    from = defaultFrom;
    to = addUtcDays(defaultTo, 1);
  }

  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    from = addUtcDays(to, -MAX_RANGE_DAYS);
  }

  return { from, to };
}

export function formatAdminMarketingDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function getAdminMarketingAnalytics(range: AdminMarketingDateRange) {
  try {
    return await queryAdminMarketingAnalytics(range);
  } catch {
    return emptyAdminMarketingAnalytics(range);
  }
}

async function queryAdminMarketingAnalytics(range: AdminMarketingDateRange) {
  const retentionTo = addUtcDays(range.to, 63);
  const [allEvents, activeSubscriptions] = await Promise.all([
    prisma.marketingEvent.findMany({
      where: { occurredAt: { gte: range.from, lt: retentionTo } },
      select: {
        id: true,
        name: true,
        occurredAt: true,
        userId: true,
        clientId: true,
        projectId: true,
        budgetId: true,
        isDemo: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        firstTouchUtmSource: true,
        firstTouchUtmMedium: true,
        firstTouchUtmCampaign: true,
        firstTouchUtmContent: true,
      },
    }),
    prisma.billingSubscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
      select: { userId: true },
    }),
  ]);

  const events = allEvents.filter((event) => event.occurredAt >= range.from && event.occurredAt < range.to);
  const identityAliases = buildIdentityAliases(allEvents);
  const visitors = uniqueCount(events.filter((event) => event.name === "landing_view").map(getIdentity));
  const signupEvents = events.filter((event) => event.name === "signup_completed");
  const activatedEvents = events.filter((event) => ACTIVATION_EVENTS.has(event.name) && event.isDemo !== true);
  const activatedIdentities = new Set(
    activatedEvents.map((event) => resolveKnownIdentity(event, identityAliases)).filter(isPresent),
  );
  const signupIdentities = new Set(
    signupEvents.map((event) => resolveKnownIdentity(event, identityAliases)).filter(isPresent),
  );
  const utmBreakdown = buildUtmBreakdown(signupEvents, identityAliases, activatedIdentities);
  const cohorts = buildCohorts(signupEvents, allEvents, identityAliases);
  const ahaMoments = buildAhaMoments(signupEvents, allEvents, identityAliases);
  const wau = uniqueCount(
    events
      .filter((event) => ENGAGEMENT_EVENTS.has(event.name) && event.isDemo !== true && event.userId)
      .map((event) => event.userId),
  );
  const wab = uniqueCount(
    events
      .filter((event) => ENGAGEMENT_EVENTS.has(event.name) && event.isDemo !== true)
      .map((event) => event.budgetId ?? event.projectId ?? getIdentity(event)),
  );
  const proUsers = new Set(activeSubscriptions.map((subscription) => subscription.userId));
  const newProUsers = new Set(
    events
      .filter((event) => event.name === "subscription_created" && event.userId)
      .map((event) => event.userId)
      .filter(isPresent),
  );

  return {
    available: true,
    range: {
      from: range.from.toISOString(),
      to: new Date(range.to.getTime() - 1).toISOString(),
    },
    metrics: {
      visitors,
      signups: signupIdentities.size,
      activated: activatedIdentities.size,
      wau,
      wab,
      pro: proUsers.size,
      newPro: newProUsers.size,
      upgradeClicked: events.filter((event) => event.name === "upgrade_clicked").length,
      checkoutStarted: events.filter((event) => event.name === "checkout_started").length,
      subscriptionCreated: events.filter((event) => event.name === "subscription_created").length,
    },
    rates: {
      signupRate: percentage(signupIdentities.size, visitors),
      activationRate: percentage(activatedIdentities.size, signupIdentities.size),
      proRate: percentage(newProUsers.size, activatedIdentities.size),
    },
    byUtm: utmBreakdown.slice(0, 10),
    cohorts,
    ahaMoments,
  };
}

type MarketingEventRow = {
  id: string;
  name: string;
  occurredAt: Date;

  userId: string | null;
  clientId: string | null;
  projectId: string | null;
  budgetId: string | null;
  isDemo: boolean | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  firstTouchUtmSource: string | null;
  firstTouchUtmMedium: string | null;
  firstTouchUtmCampaign: string | null;
  firstTouchUtmContent: string | null;
};

function emptyAdminMarketingAnalytics(range: AdminMarketingDateRange) {
  return {
    available: false,
    range: {
      from: range.from.toISOString(),
      to: new Date(range.to.getTime() - 1).toISOString(),
    },
    metrics: {
      visitors: 0,
      signups: 0,
      activated: 0,
      wau: 0,
      wab: 0,
      pro: 0,
      newPro: 0,
      upgradeClicked: 0,
      checkoutStarted: 0,
      subscriptionCreated: 0,
    },
    rates: {
      signupRate: 0,
      activationRate: 0,
      proRate: 0,
    },
    byUtm: [],
    cohorts: [],
    ahaMoments: [],
  };
}

function buildIdentityAliases(events: readonly MarketingEventRow[]) {
  const aliases = new Map<string, string>();
  for (const event of events) {
    const identity = event.userId ?? event.clientId;
    if (!identity) {
      continue;
    }
    if (event.userId) aliases.set(event.userId, identity);
    if (event.clientId) aliases.set(event.clientId, identity);
  }
  return aliases;
}

function buildUtmBreakdown(
  events: readonly MarketingEventRow[],
  aliases: ReadonlyMap<string, string>,
  activatedIdentities: ReadonlySet<string>,
) {
  const groups = new Map<string, {
    source: string;
    medium: string;
    campaign: string;
    content: string;
    identities: Set<string>;
  }>();

  for (const event of events) {
    const dimensions = {
      source: event.firstTouchUtmSource ?? event.utmSource ?? "(directo / desconocido)",
      medium: event.firstTouchUtmMedium ?? event.utmMedium ?? "(sin medio)",
      campaign: event.firstTouchUtmCampaign ?? event.utmCampaign ?? "(sin campaña)",
      content: event.firstTouchUtmContent ?? event.utmContent ?? "(sin contenido)",
    };
    const key = JSON.stringify(dimensions);
    const group = groups.get(key) ?? { ...dimensions, identities: new Set<string>() };
    group.identities.add(resolveKnownIdentity(event, aliases));
    groups.set(key, group);
  }

  return [...groups.values()]
    .map(({ identities, ...dimensions }) => ({
      ...dimensions,
      signups: identities.size,
      activated: [...identities].filter((identity) => activatedIdentities.has(identity)).length,
    }))
    .sort((left, right) => right.signups - left.signups || right.activated - left.activated);
}

function buildAhaMoments(
  signupEvents: readonly MarketingEventRow[],
  allEvents: readonly MarketingEventRow[],
  aliases: ReadonlyMap<string, string>,
) {
  const signupDates = new Map<string, Date>();
  for (const event of signupEvents) {
    const identity = resolveKnownIdentity(event, aliases);
    const existing = signupDates.get(identity);
    if (!existing || event.occurredAt < existing) {
      signupDates.set(identity, event.occurredAt);
    }
  }

  const firstActions = new Map<string, { eventName: string; occurredAt: Date }>();
  for (const event of allEvents) {
    if (event.isDemo === true || !event.userId || !ACTIVATION_EVENTS.has(event.name)) {
      continue;
    }

    const identity = resolveKnownIdentity(event, aliases);
    const signupAt = signupDates.get(identity);
    if (!signupAt || event.occurredAt <= signupAt || event.occurredAt >= addUtcDays(signupAt, 7)) {
      continue;
    }

    const existing = firstActions.get(identity);
    if (!existing || event.occurredAt < existing.occurredAt) {
      firstActions.set(identity, { eventName: event.name, occurredAt: event.occurredAt });
    }
  }

  const usersByAction = new Map<string, Set<string>>();
  for (const [identity, action] of firstActions) {
    const users = usersByAction.get(action.eventName) ?? new Set<string>();
    users.add(identity);
    usersByAction.set(action.eventName, users);
  }

  return [...usersByAction.entries()]
    .map(([eventName, users]) => ({
      eventName,
      users: users.size,
      activationRate: percentage(users.size, signupDates.size),
      shareOfActivated: percentage(users.size, firstActions.size),
    }))
    .sort((left, right) => right.users - left.users || left.eventName.localeCompare(right.eventName));
}

function buildCohorts(
  signupEvents: readonly MarketingEventRow[],
  allEvents: readonly MarketingEventRow[],
  aliases: ReadonlyMap<string, string>,
) {
  const groups = new Map<string, { cohortStart: Date; identities: Set<string> }>();

  for (const event of signupEvents) {
    const cohortStart = startOfUtcWeek(event.occurredAt);
    const key = cohortStart.toISOString();
    const group = groups.get(key) ?? { cohortStart, identities: new Set<string>() };
    group.identities.add(resolveKnownIdentity(event, aliases));
    groups.set(key, group);
  }

  const now = new Date();
  return [...groups.values()]
    .sort((left, right) => left.cohortStart.getTime() - right.cohortStart.getTime())
    .map(({ cohortStart, identities }) => {
      const activated = countCohortActivity({
        allEvents,
        aliases,
        identities,
        from: cohortStart,
        to: addUtcDays(cohortStart, 7),
        activationOnly: true,
      });
      const retention = [7, 28, 56].map((offset) => {
        const from = addUtcDays(cohortStart, offset);
        const to = addUtcDays(from, 7);
        const mature = to <= now;
        const users = mature
          ? countCohortActivity({ allEvents, aliases, identities, from, to, activationOnly: false })
          : null;
        return {
          users,
          rate: users === null ? null : percentage(users, identities.size),
        };
      });

      return {
        week: formatDateInput(cohortStart),
        signups: identities.size,
        activated,
        activationRate: percentage(activated, identities.size),
        w1: retention[0],
        w4: retention[1],
        w8: retention[2],
      };
    });
}

function countCohortActivity(input: {
  allEvents: readonly MarketingEventRow[];
  aliases: ReadonlyMap<string, string>;
  identities: ReadonlySet<string>;
  from: Date;
  to: Date;
  activationOnly: boolean;
}) {
  const activeIdentities = new Set<string>();

  for (const event of input.allEvents) {
    if (
      event.occurredAt < input.from ||
      event.occurredAt >= input.to ||
      event.isDemo === true ||
      !event.userId ||
      !ENGAGEMENT_EVENTS.has(event.name) ||
      (input.activationOnly && !ACTIVATION_EVENTS.has(event.name))
    ) {
      continue;
    }

    const identity = resolveKnownIdentity(event, input.aliases);
    if (input.identities.has(identity)) {
      activeIdentities.add(identity);
    }
  }

  return activeIdentities.size;
}

function startOfUtcWeek(value: Date) {
  const day = value.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() - daysSinceMonday));
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function resolveKnownIdentity(event: MarketingEventRow, aliases: ReadonlyMap<string, string>) {
  const identity = getIdentity(event);
  return aliases.get(identity) ?? identity;
}

function getIdentity(event: Pick<MarketingEventRow, "id" | "userId" | "clientId">) {
  return event.userId ?? event.clientId ?? `event:${event.id}`;
}

function uniqueCount(values: readonly (string | null | undefined)[]) {
  return new Set(values.filter(isPresent)).size;
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function parseDateInput(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function isPresent(value: string | null | undefined): value is string {
  return Boolean(value);
}
