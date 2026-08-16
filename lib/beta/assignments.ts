import {
  BetaAssignmentMode,
  BetaCampaignStatus,
  BetaGrantSource,
  BetaGrantStatus,
  BillingSubscriptionStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { trackServerEvent } from "@/lib/analytics/events";
import { recordAdminAudit } from "@/lib/data/admin-audit";
import { getActiveBetaAccess } from "@/lib/beta/access";
import { trackBetaEligible } from "@/lib/beta/analytics";
import type { BetaEligibilityResult } from "@/lib/beta/types";
import { betaEligibilityRulesSchema } from "@/lib/beta/validation";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PAID_SUBSCRIPTION_STATUSES: BillingSubscriptionStatus[] = [
  BillingSubscriptionStatus.ACTIVE,
  BillingSubscriptionStatus.TRIALING,
];

const reasonMessages = {
  CAMPAIGN_NOT_ACTIVE: "CAMPAIGN_NOT_ACTIVE",
  CAMPAIGN_NOT_STARTED: "CAMPAIGN_NOT_STARTED",
  CAMPAIGN_FINISHED: "CAMPAIGN_FINISHED",
  CAMPAIGN_LIMIT_REACHED: "CAMPAIGN_LIMIT_REACHED",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_SUSPENDED: "USER_SUSPENDED",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  NOT_NEW_USER: "NOT_NEW_USER",
  EMAIL_DOMAIN_NOT_ALLOWED: "EMAIL_DOMAIN_NOT_ALLOWED",
  UTM_SOURCE_NOT_ALLOWED: "UTM_SOURCE_NOT_ALLOWED",
  UTM_CAMPAIGN_NOT_ALLOWED: "UTM_CAMPAIGN_NOT_ALLOWED",
  CODE_REQUIRED: "CODE_REQUIRED",
  INVALID_CODE: "INVALID_CODE",
  PAID_SUBSCRIPTION: "PAID_SUBSCRIPTION",
  PREVIOUS_BETA: "PREVIOUS_BETA",
  ACTIVE_BETA: "ACTIVE_BETA",
} as const;

export async function assignAutomaticBetaForUser(userId: string) {
  const now = new Date();
  const campaigns = await prisma.betaCampaign.findMany({
    where: {
      status: BetaCampaignStatus.ACTIVE,
      assignmentMode: { in: [BetaAssignmentMode.AUTOMATIC, BetaAssignmentMode.MIXED] },
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  for (const campaign of campaigns) {
    try {
      await assignBetaGrant({ campaignId: campaign.id, userId, source: BetaGrantSource.AUTOMATIC });
      return campaign.id;
    } catch {
      // Continue to the next eligible campaign; one campaign must not block another.
    }
  }

  return null;
}

export async function evaluateBetaEligibility(options: {
  campaignId: string;
  userId: string;
  code?: string | null;
  now?: Date;
}): Promise<BetaEligibilityResult> {
  const now = options.now ?? new Date();
  const campaign = await prisma.betaCampaign.findUnique({ where: { id: options.campaignId } });

  if (!campaign) {
    return { eligible: false, reasons: [reasonMessages.CAMPAIGN_NOT_ACTIVE], existingActiveGrantId: null, hasPaidSubscription: false };
  }

  const rules = betaEligibilityRulesSchema.parse(campaign.eligibilityRules);
  const [user, paidSubscription, previousGrant, activeGrant, attribution] = await Promise.all([
    prisma.user.findUnique({
      where: { id: options.userId },
      select: { email: true, emailVerifiedAt: true, status: true, createdAt: true },
    }),
    prisma.billingSubscription.findFirst({
      where: { userId: options.userId, status: { in: PAID_SUBSCRIPTION_STATUSES } },
      select: { id: true },
    }),
    prisma.betaGrant.findFirst({
      where: { userId: options.userId },
      select: { id: true },
    }),
    getActiveBetaAccess({ userId: options.userId, now }),
    prisma.marketingEvent.findFirst({
      where: { userId: options.userId, name: "signup_completed" },
      orderBy: { occurredAt: "desc" },
      select: {
        utmSource: true,
        firstTouchUtmSource: true,
        utmCampaign: true,
        firstTouchUtmCampaign: true,
      },
    }),
  ]);

  const reasons: string[] = [];
  const hasPaidSubscription = Boolean(paidSubscription);

  if (campaign.status !== BetaCampaignStatus.ACTIVE) reasons.push(reasonMessages.CAMPAIGN_NOT_ACTIVE);
  if (campaign.status === BetaCampaignStatus.FINISHED) reasons.push(reasonMessages.CAMPAIGN_FINISHED);
  if (campaign.startsAt > now) reasons.push(reasonMessages.CAMPAIGN_NOT_STARTED);
  if (campaign.endsAt && campaign.endsAt <= now) reasons.push(reasonMessages.CAMPAIGN_FINISHED);
  if (!user) reasons.push(reasonMessages.USER_NOT_FOUND);
  if (user?.status === "SUSPENDED") reasons.push(reasonMessages.USER_SUSPENDED);
  if (rules.requireVerifiedEmail && !user?.emailVerifiedAt) reasons.push(reasonMessages.EMAIL_NOT_VERIFIED);
  if (rules.newUsersOnly && user && user.createdAt < campaign.startsAt) reasons.push(reasonMessages.NOT_NEW_USER);
  if (rules.excludePaidSubscribers && hasPaidSubscription) reasons.push(reasonMessages.PAID_SUBSCRIPTION);
  if (rules.excludePreviousBetaUsers && previousGrant) reasons.push(reasonMessages.PREVIOUS_BETA);
  if (activeGrant) reasons.push(reasonMessages.ACTIVE_BETA);

  const emailDomain = user?.email.split("@").pop()?.toLowerCase() ?? null;
  if (rules.allowedEmailDomains.length > 0 && (!emailDomain || !rules.allowedEmailDomains.includes(emailDomain))) {
    reasons.push(reasonMessages.EMAIL_DOMAIN_NOT_ALLOWED);
  }

  const utmSource = (attribution?.firstTouchUtmSource ?? attribution?.utmSource)?.toLowerCase() ?? null;
  const utmCampaign = (attribution?.firstTouchUtmCampaign ?? attribution?.utmCampaign)?.toLowerCase() ?? null;
  if (rules.allowedUtmSources.length > 0 && (!utmSource || !rules.allowedUtmSources.includes(utmSource))) {
    reasons.push(reasonMessages.UTM_SOURCE_NOT_ALLOWED);
  }
  if (rules.allowedUtmCampaigns.length > 0 && (!utmCampaign || !rules.allowedUtmCampaigns.includes(utmCampaign))) {
    reasons.push(reasonMessages.UTM_CAMPAIGN_NOT_ALLOWED);
  }

  const normalizedCode = options.code?.trim().toLowerCase() ?? null;
  if (rules.requiresCode && !normalizedCode) reasons.push(reasonMessages.CODE_REQUIRED);
  if (normalizedCode && campaign.code !== normalizedCode) reasons.push(reasonMessages.INVALID_CODE);

  const eligible = reasons.length === 0;
  if (eligible) {
    void trackBetaEligible({
      userId: options.userId,
      campaignName: campaign.name,
      durationDays: campaign.durationDays,
    });
  }

  return {
    eligible,
    reasons: [...new Set(reasons)],
    existingActiveGrantId: activeGrant?.grantId ?? null,
    hasPaidSubscription,
  };
}

export async function previewBetaAssignments(options: {
  campaignId: string;
  userIds: string[];
  code?: string | null;
  now?: Date;
}) {
  const campaign = await prisma.betaCampaign.findUnique({
    where: { id: options.campaignId },
    select: { maxAssignments: true },
  });

  if (!campaign) {
    throw new Error("Campaña beta no encontrada.");
  }

  const results = await Promise.all(
    options.userIds.map(async (userId) => ({
      userId,
      result: await evaluateBetaEligibility({
        campaignId: options.campaignId,
        userId,
        code: options.code,
        now: options.now,
      }),
    })),
  );
  const assignedCount = await prisma.betaGrant.count({
    where: { campaignId: options.campaignId, status: { not: BetaGrantStatus.REVOKED } },
  });

  return {
    eligible: results.filter((entry) => entry.result.eligible).map((entry) => entry.userId),
    excluded: results
      .filter((entry) => !entry.result.eligible)
      .map((entry) => ({ userId: entry.userId, reasons: entry.result.reasons })),
    remainingAssignments: campaign.maxAssignments === null ? null : Math.max(0, campaign.maxAssignments - assignedCount),
  };
}

export async function assignBetaGrant(input: {
  campaignId: string;
  userId: string;
  source: BetaGrantSource;
  assignedById?: string | null;
  reason?: string | null;
  startsAt?: Date;
  code?: string | null;
}) {
  const now = new Date();
  const existing = await prisma.betaGrant.findUnique({
    where: { campaignId_userId: { campaignId: input.campaignId, userId: input.userId } },
    select: { id: true, startsAt: true, expiresAt: true },
  });

  if (existing) {
    return { grantId: existing.id, created: false, startsAt: existing.startsAt, expiresAt: existing.expiresAt };
  }

  const eligibility = await evaluateBetaEligibility({
    campaignId: input.campaignId,
    userId: input.userId,
    code: input.code,
    now,
  });

  if (!eligibility.eligible) {
    throw new Error(`Usuario no elegible para beta: ${eligibility.reasons.join(", ")}`);
  }

  const campaign = await prisma.betaCampaign.findUnique({
    where: { id: input.campaignId },
    select: { name: true, durationDays: true, maxAssignments: true, status: true, startsAt: true },
  });
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });

  if (!campaign || !user) {
    throw new Error("Campaña o usuario no encontrado.");
  }

  const startsAt = input.startsAt ?? now;
  const expiresAt = new Date(startsAt.getTime() + campaign.durationDays * DAY_IN_MS);
  const status = startsAt <= now ? BetaGrantStatus.ACTIVE : BetaGrantStatus.SCHEDULED;
  const grant = await prisma.$transaction(async (tx) => {
    const assignedCount = await tx.betaGrant.count({
      where: { campaignId: input.campaignId, status: { not: BetaGrantStatus.REVOKED } },
    });

    if (campaign.maxAssignments !== null && assignedCount >= campaign.maxAssignments) {
      throw new Error("La campaña beta alcanzó su límite de asignaciones.");
    }

    return tx.betaGrant.create({
      data: {
        campaignId: input.campaignId,
        userId: input.userId,
        planSlug: "pro",
        status,
        source: input.source,
        startsAt,
        expiresAt,
        assignedById: input.assignedById ?? null,
        metadata: input.reason ? ({ reason: input.reason } satisfies Prisma.InputJsonValue) : undefined,
      },
      select: { id: true, startsAt: true, expiresAt: true },
    });
  });

  await recordAdminAudit({
    actorUserId: input.assignedById ?? null,
    targetUserId: input.userId,
    targetEmail: user.email,
    action: "BETA_GRANT_ASSIGNED",
    detail: input.reason ?? "Grant beta asignado.",
    metadata: {
      campaignId: input.campaignId,
      grantId: grant.id,
      source: input.source,
      durationDays: campaign.durationDays,
    },
  });
  void trackServerEvent("beta_assigned", {
    userId: input.userId,
    campaign: campaign.name,
    duration_days: campaign.durationDays,
    grant_source: input.source,
    target_plan: "pro",
  }).catch(() => undefined);

  return { grantId: grant.id, created: true, startsAt: grant.startsAt, expiresAt: grant.expiresAt };
}

export async function revokeBetaGrant(options: {
  grantId: string;
  actorUserId: string;
  reason: string;
}) {
  const grant = await prisma.betaGrant.findUnique({
    where: { id: options.grantId },
    include: { user: { select: { email: true } } },
  });

  if (!grant) throw new Error("Grant beta no encontrado.");
  if (grant.status === BetaGrantStatus.REVOKED || grant.revokedAt) {
    return { userId: grant.userId, companyId: grant.companyId };
  }

  await prisma.betaGrant.update({
    where: { id: options.grantId },
    data: {
      status: BetaGrantStatus.REVOKED,
      revokedAt: new Date(),
      revokedById: options.actorUserId,
      metadata: mergeReasonMetadata(grant.metadata, options.reason),
    },
  });

  await recordAdminAudit({
    actorUserId: options.actorUserId,
    targetUserId: grant.userId,
    targetEmail: grant.user.email,
    action: "BETA_GRANT_REVOKED",
    detail: options.reason,
    metadata: { grantId: grant.id, campaignId: grant.campaignId },
  });
  void trackServerEvent("beta_revoked", { userId: grant.userId, target_plan: "pro" }).catch(() => undefined);

  return { userId: grant.userId, companyId: grant.companyId };
}

export async function extendBetaGrant(options: {
  grantId: string;
  actorUserId: string;
  newExpiresAt: Date;
  reason: string;
}) {
  const grant = await prisma.betaGrant.findUnique({
    where: { id: options.grantId },
    include: { user: { select: { email: true } } },
  });

  if (!grant) throw new Error("Grant beta no encontrado.");
  if (grant.status === BetaGrantStatus.REVOKED || grant.revokedAt) throw new Error("No se puede extender un grant revocado.");
  if (options.newExpiresAt <= grant.startsAt || options.newExpiresAt <= grant.expiresAt) {
    throw new Error("La nueva fecha debe ser posterior al vencimiento actual.");
  }

  await prisma.betaGrant.update({
    where: { id: options.grantId },
    data: {
      expiresAt: options.newExpiresAt,
      status: options.newExpiresAt > new Date() ? grant.status : BetaGrantStatus.EXPIRED,
      metadata: mergeReasonMetadata(grant.metadata, options.reason),
    },
  });

  await recordAdminAudit({
    actorUserId: options.actorUserId,
    targetUserId: grant.userId,
    targetEmail: grant.user.email,
    action: "BETA_GRANT_EXTENDED",
    detail: options.reason,
    metadata: {
      grantId: grant.id,
      campaignId: grant.campaignId,
      previousExpiresAt: grant.expiresAt.toISOString(),
      newExpiresAt: options.newExpiresAt.toISOString(),
    },
  });

  return { userId: grant.userId, companyId: grant.companyId };
}

function mergeReasonMetadata(metadata: Prisma.JsonValue | null, reason: string): Prisma.InputJsonValue {
  const existing = isJsonRecord(metadata) ? metadata : {};
  return { ...existing, lastReason: reason, lastReasonAt: new Date().toISOString() };
}

function isJsonRecord(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
