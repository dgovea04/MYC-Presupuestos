import { prisma } from "@/lib/db/prisma";
import type { AdminMarketingDateRange } from "@/lib/data/admin-marketing-analytics";

const OBSERVATION_WINDOW_DAYS = 180;
const ELIGIBILITY_EVENTS = new Set(["beta_eligible"]);
const ACTIVATION_EVENTS = new Set(["beta_started", "beta_feature_used"]);
const FEATURE_EVENTS = new Set(["beta_feature_used"]);
const CONVERSION_EVENTS = new Set(["subscription_created", "beta_converted"]);

export type BetaAnalyticsGrant = {
  campaignId: string;
  campaignName: string;
  durationDays: number;
  userId: string;
  createdAt: Date;
  startsAt: Date;
  expiresAt: Date;
};

export type BetaAnalyticsEvent = {
  name: string;
  userId: string | null;
  occurredAt: Date;
  campaign?: string | null;
};

export type BetaRetentionMetric = {
  users: number;
  rate: number;
};

export type BetaConversionWindows = {
  duringBeta: BetaRetentionMetric;
  postExpiry0To7d: BetaRetentionMetric;
  postExpiry8To14d: BetaRetentionMetric;
};

export type AdminBetaAnalytics = Awaited<ReturnType<typeof getAdminBetaAnalytics>>;

export async function getAdminBetaAnalytics(
  range: AdminMarketingDateRange,
  campaignId?: string,
  durationDays?: 60 | 90,
) {
  const observationTo = addUtcDays(range.to, OBSERVATION_WINDOW_DAYS);

  try {
    const [grants, events] = await Promise.all([
      prisma.betaGrant.findMany({
        where: {
          createdAt: { gte: range.from, lt: observationTo },
          ...(campaignId ? { campaignId } : {}),
          ...(durationDays ? { campaign: { durationDays } } : {}),
        },
        select: {
          campaignId: true,
          userId: true,
          createdAt: true,
          startsAt: true,
          expiresAt: true,
          campaign: { select: { name: true, durationDays: true } },
        },
      }),
      prisma.marketingEvent.findMany({
        where: {
          occurredAt: { gte: range.from, lt: observationTo },
          name: {
            in: [
              "beta_eligible",
              "beta_started",
              "beta_feature_used",
              "beta_upgrade_clicked",
              "beta_checkout_started",
              "beta_converted",
              "subscription_created",
            ],
          },
        },
        select: { name: true, userId: true, occurredAt: true, parameters: true },
      }),
    ]);

    return calculateBetaAnalytics(range, grants.map(toGrant), events.map(toEvent), new Date());
  } catch {
    return emptyBetaAnalytics(range, observationTo);
  }
}

export function calculateBetaAnalytics(
  range: AdminMarketingDateRange,
  grants: readonly BetaAnalyticsGrant[],
  events: readonly BetaAnalyticsEvent[],
  now = new Date(),
) {
  const groups = new Map<string, {
    campaignId: string;
    campaignName: string;
    durationDays: number;
    grants: BetaAnalyticsGrant[];
  }>();

  for (const grant of grants) {
    const group = groups.get(grant.campaignId) ?? {
      campaignId: grant.campaignId,
      campaignName: grant.campaignName,
      durationDays: grant.durationDays,
      grants: [],
    };
    group.grants.push(grant);
    groups.set(grant.campaignId, group);
  }

  const byCampaign = [...groups.values()].map((group) => calculateCampaignMetrics(group, events, now));
  const observationTo = addUtcDays(range.to, OBSERVATION_WINDOW_DAYS);
  const assignedUsers = new Set(grants.map((grant) => grant.userId));
  const eligibleUsers = new Set(events.filter((event) => ELIGIBILITY_EVENTS.has(event.name) && event.userId).map((event) => event.userId as string));
  const activatedUsers = usersForGrantWindow(grants, events, ACTIVATION_EVENTS, 0, 7);
  const conversion = combineConversionWindows(byCampaign, assignedUsers.size);
  const retention = combineRetention(byCampaign, assignedUsers.size);

  return {
    available: true,
    range: {
      from: range.from.toISOString(),
      to: new Date(range.to.getTime() - 1).toISOString(),
    },
    observationWindowDays: OBSERVATION_WINDOW_DAYS,
    observationTo: observationTo.toISOString(),
    metrics: {
      eligible: eligibleUsers.size,
      assigned: assignedUsers.size,
      activated: activatedUsers.size,
      activationRate: percentage(activatedUsers.size, assignedUsers.size),
      upgradeClicked: countUsersForEvents(events, assignedUsers, new Set(["beta_upgrade_clicked"])),
      checkoutStarted: countUsersForEvents(events, assignedUsers, new Set(["beta_checkout_started"])),
      converted: conversion.total.users,
      conversionRate: conversion.total.rate,
      expiringWithin14d: byCampaign.reduce((sum, campaign) => sum + campaign.expiringWithin14d, 0),
      expiredWithoutConversion: byCampaign.reduce((sum, campaign) => sum + campaign.expiredWithoutConversion, 0),
    },
    retention,
    conversionWindows: conversion,
    byCampaign,
    campaignCount: groups.size,
    userCampaignCount: assignedUsers.size,
  };
}

function calculateCampaignMetrics(
  group: { campaignId: string; campaignName: string; durationDays: number; grants: BetaAnalyticsGrant[] },
  events: readonly BetaAnalyticsEvent[],
  now: Date,
) {
  const campaignUsers = new Set(group.grants.map((grant) => grant.userId));
  const activatedUsers = usersForGrantWindow(group.grants, events, ACTIVATION_EVENTS, 0, 7);
  const retention = {
    w1: retentionMetric(usersForGrantWindow(group.grants, events, FEATURE_EVENTS, 7, 14), campaignUsers.size),
    w4: retentionMetric(usersForGrantWindow(group.grants, events, FEATURE_EVENTS, 28, 35), campaignUsers.size),
    w8: retentionMetric(usersForGrantWindow(group.grants, events, FEATURE_EVENTS, 56, 63), campaignUsers.size),
  };
  const conversionWindows = {
    duringBeta: retentionMetric(usersForGrantConversionWindow(group.grants, events, "duringBeta"), campaignUsers.size),
    postExpiry0To7d: retentionMetric(usersForGrantConversionWindow(group.grants, events, "postExpiry0To7d"), campaignUsers.size),
    postExpiry8To14d: retentionMetric(usersForGrantConversionWindow(group.grants, events, "postExpiry8To14d"), campaignUsers.size),
  };
  const convertedUsers = new Set([
    ...usersForGrantConversionWindow(group.grants, events, "duringBeta"),
    ...usersForGrantConversionWindow(group.grants, events, "postExpiry0To7d"),
    ...usersForGrantConversionWindow(group.grants, events, "postExpiry8To14d"),
  ]);
  const expiringWithin14d = group.grants.filter((grant) => {
    const daysRemaining = Math.ceil((grant.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return grant.startsAt <= now && grant.expiresAt > now && daysRemaining <= 14;
  }).length;
  const expiredWithoutConversion = group.grants.filter((grant) => grant.expiresAt <= now && !convertedUsers.has(grant.userId)).length;

  return {
    campaignId: group.campaignId,
    campaignName: group.campaignName,
    durationDays: group.durationDays,
    eligible: countCampaignEvents(events, group.campaignName, campaignUsers, ELIGIBILITY_EVENTS),
    assigned: campaignUsers.size,
    activated: activatedUsers.size,
    activationRate: percentage(activatedUsers.size, campaignUsers.size),
    upgradeClicked: countUsersForEvents(events, campaignUsers, new Set(["beta_upgrade_clicked"])),
    checkoutStarted: countUsersForEvents(events, campaignUsers, new Set(["beta_checkout_started"])),
    converted: convertedUsers.size,
    conversionRate: percentage(convertedUsers.size, campaignUsers.size),
    earliestExpiry: earliestExpiry(group.grants),
    expiringWithin14d,
    expiredWithoutConversion,
    retention,
    conversionWindows,
  };
}

function usersForGrantWindow(
  grants: readonly BetaAnalyticsGrant[],
  events: readonly BetaAnalyticsEvent[],
  names: ReadonlySet<string>,
  startOffsetDays: number,
  endOffsetDays: number,
) {
  const users = new Set<string>();
  for (const grant of grants) {
    const from = addUtcDays(grant.startsAt, startOffsetDays);
    const to = addUtcDays(grant.startsAt, endOffsetDays);
    for (const event of events) {
      if (event.userId === grant.userId && names.has(event.name) && event.occurredAt >= from && event.occurredAt < to) {
        users.add(grant.userId);
        break;
      }
    }
  }
  return users;
}

function usersForGrantConversionWindow(
  grants: readonly BetaAnalyticsGrant[],
  events: readonly BetaAnalyticsEvent[],
  window: keyof BetaConversionWindows,
) {
  const users = new Set<string>();
  for (const grant of grants) {
    const from = window === "duringBeta"
      ? grant.startsAt
      : window === "postExpiry0To7d"
        ? grant.expiresAt
        : addUtcDays(grant.expiresAt, 7);
    const to = window === "duringBeta"
      ? grant.expiresAt
      : window === "postExpiry0To7d"
        ? addUtcDays(grant.expiresAt, 7)
        : addUtcDays(grant.expiresAt, 14);

    if (events.some((event) => event.userId === grant.userId && CONVERSION_EVENTS.has(event.name) && event.occurredAt >= from && event.occurredAt < to)) {
      users.add(grant.userId);
    }
  }
  return users;
}

function combineRetention(campaigns: readonly ReturnType<typeof calculateCampaignMetrics>[], denominator: number) {
  return {
    w1: combineRetentionMetric(campaigns.map((campaign) => campaign.retention.w1), denominator),
    w4: combineRetentionMetric(campaigns.map((campaign) => campaign.retention.w4), denominator),
    w8: combineRetentionMetric(campaigns.map((campaign) => campaign.retention.w8), denominator),
  };
}

function combineConversionWindows(campaigns: readonly ReturnType<typeof calculateCampaignMetrics>[], denominator: number) {
  const duringBetaUsers = sumMetric(campaigns.map((campaign) => campaign.conversionWindows.duringBeta));
  const postExpiry0To7dUsers = sumMetric(campaigns.map((campaign) => campaign.conversionWindows.postExpiry0To7d));
  const postExpiry8To14dUsers = sumMetric(campaigns.map((campaign) => campaign.conversionWindows.postExpiry8To14d));
  const totalUsers = duringBetaUsers + postExpiry0To7dUsers + postExpiry8To14dUsers;

  return {
    duringBeta: { users: duringBetaUsers, rate: percentage(duringBetaUsers, denominator) },
    postExpiry0To7d: { users: postExpiry0To7dUsers, rate: percentage(postExpiry0To7dUsers, denominator) },
    postExpiry8To14d: { users: postExpiry8To14dUsers, rate: percentage(postExpiry8To14dUsers, denominator) },
    total: { users: totalUsers, rate: percentage(totalUsers, denominator) },
  };
}

function combineRetentionMetric(metrics: readonly BetaRetentionMetric[], denominator: number) {
  const users = metrics.reduce((sum, metric) => sum + metric.users, 0);
  return { users, rate: percentage(users, denominator) };
}

function sumMetric(metrics: readonly BetaRetentionMetric[]) {
  return metrics.reduce((sum, metric) => sum + metric.users, 0);
}

function retentionMetric(users: ReadonlySet<string>, denominator: number): BetaRetentionMetric {
  return { users: users.size, rate: percentage(users.size, denominator) };
}

function countUsersForEvents(events: readonly BetaAnalyticsEvent[], users: ReadonlySet<string>, names: ReadonlySet<string>) {
  return new Set(
    events
      .filter((event) => event.userId && users.has(event.userId) && names.has(event.name))
      .map((event) => event.userId),
  ).size;
}

function countCampaignEvents(
  events: readonly BetaAnalyticsEvent[],
  campaignName: string,
  users: ReadonlySet<string>,
  names: ReadonlySet<string>,
) {
  return new Set(
    events
      .filter((event) => event.userId && users.has(event.userId) && names.has(event.name) && event.campaign === campaignName)
      .map((event) => event.userId),
  ).size;
}

function toEvent(row: {
  name: string;
  userId: string | null;
  occurredAt: Date;
  parameters: unknown;
}): BetaAnalyticsEvent {
  const parameters = isJsonRecord(row.parameters) ? row.parameters : null;
  return {
    name: row.name,
    userId: row.userId,
    occurredAt: row.occurredAt,
    campaign: typeof parameters?.campaign === "string" ? parameters.campaign : null,
  };
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function earliestExpiry(grants: readonly BetaAnalyticsGrant[]) {
  return grants
    .map((grant) => grant.expiresAt)
    .sort((left, right) => left.getTime() - right.getTime())[0]
    ?.toISOString() ?? null;
}

function toGrant(row: {
  campaignId: string;
  userId: string;
  createdAt: Date;
  startsAt: Date;
  expiresAt: Date;
  campaign: { name: string; durationDays: number };
}): BetaAnalyticsGrant {
  return {
    campaignId: row.campaignId,
    campaignName: row.campaign.name,
    durationDays: row.campaign.durationDays,
    userId: row.userId,
    createdAt: row.createdAt,
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
  };
}

function emptyBetaAnalytics(range: AdminMarketingDateRange, observationTo: Date) {
  const emptyMetric = { users: 0, rate: 0 };
  return {
    available: false,
    range: { from: range.from.toISOString(), to: new Date(range.to.getTime() - 1).toISOString() },
    observationWindowDays: OBSERVATION_WINDOW_DAYS,
    observationTo: observationTo.toISOString(),
    metrics: {
      eligible: 0,
      assigned: 0,
      activated: 0,
      activationRate: 0,
      upgradeClicked: 0,
      checkoutStarted: 0,
      converted: 0,
      conversionRate: 0,
      expiringWithin14d: 0,
      expiredWithoutConversion: 0,
    },
    retention: { w1: emptyMetric, w4: emptyMetric, w8: emptyMetric },
    conversionWindows: {
      duringBeta: emptyMetric,
      postExpiry0To7d: emptyMetric,
      postExpiry8To14d: emptyMetric,
      total: emptyMetric,
    },
    byCampaign: [],
    campaignCount: 0,
    userCampaignCount: 0,
  };
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function addUtcDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}
