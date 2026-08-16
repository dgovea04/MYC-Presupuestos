import { prisma } from "@/lib/db/prisma";
import { trackServerEvent } from "@/lib/analytics/events";
import { getActiveBetaAccess } from "@/lib/beta/access";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type BetaConversionWindow = "during_beta" | "post_expiry_0_7d" | "post_expiry_8_14d";

export async function trackBetaEligible(options: {
  userId: string;
  campaignName: string;
  durationDays: number;
}) {
  await trackSafely("beta_eligible", {
    userId: options.userId,
    campaign: options.campaignName,
    duration_days: options.durationDays,
    target_plan: "pro",
  });
}

export async function trackBetaFeatureUsed(options: {
  userId: string;
  feature: string;
  companyId?: string | null;
}) {
  const access = await getActiveBetaAccess({ userId: options.userId, companyId: options.companyId });
  if (!access) return false;

  await trackSafely("beta_feature_used", {
    userId: options.userId,
    companyId: options.companyId,
    campaign: access.campaignName,
    duration_days: daysBetween(access.startsAt, access.expiresAt),
    grant_source: access.grantSource,
    target_plan: "pro",
    days_remaining: access.daysRemaining,
    feature: options.feature,
  });
  return true;
}

export async function trackBetaCheckoutStarted(options: {
  userId: string;
  companyId?: string | null;
}) {
  const access = await getActiveBetaAccess({ userId: options.userId, companyId: options.companyId });
  if (!access) return false;

  await trackSafely("beta_checkout_started", {
    userId: options.userId,
    companyId: options.companyId,
    campaign: access.campaignName,
    duration_days: daysBetween(access.startsAt, access.expiresAt),
    grant_source: access.grantSource,
    target_plan: "pro",
    days_remaining: access.daysRemaining,
    conversion_window: "during_beta",
  });
  return true;
}

export async function trackBetaConversion(userId: string, now = new Date()) {
  const grant = await prisma.betaGrant.findFirst({
    where: {
      userId,
      revokedAt: null,
      startsAt: { lte: now },
      expiresAt: { gt: new Date(now.getTime() - 14 * DAY_IN_MS) },
    },
    orderBy: { expiresAt: "desc" },
    select: {
      startsAt: true,
      expiresAt: true,
      source: true,
      campaign: { select: { name: true, durationDays: true } },
    },
  });

  if (!grant) return false;

  const conversionWindow = getConversionWindow(grant.expiresAt, now);
  if (!conversionWindow) return false;

  await trackSafely("beta_converted", {
    userId,
    campaign: grant.campaign.name,
    duration_days: grant.campaign.durationDays,
    grant_source: grant.source,
    target_plan: "pro",
    conversion_window: conversionWindow,
  });
  return true;
}

function getConversionWindow(expiresAt: Date, now: Date): BetaConversionWindow | null {
  if (now < expiresAt) return "during_beta";

  const daysAfterExpiry = Math.floor((now.getTime() - expiresAt.getTime()) / DAY_IN_MS);
  if (daysAfterExpiry < 7) return "post_expiry_0_7d";
  if (daysAfterExpiry < 14) return "post_expiry_8_14d";
  return null;
}

function daysBetween(startsAt: Date, expiresAt: Date) {
  return Math.round((expiresAt.getTime() - startsAt.getTime()) / DAY_IN_MS);
}

async function trackSafely(name: Parameters<typeof trackServerEvent>[0], payload: Parameters<typeof trackServerEvent>[1]) {
  await trackServerEvent(name, payload).catch(() => undefined);
}
