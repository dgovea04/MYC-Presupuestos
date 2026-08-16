import { BetaGrantStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { trackServerEvent, type AnalyticsEventName } from "@/lib/analytics/events";
import { notifyBetaGrantReminder } from "@/lib/beta/notifications";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const REMINDER_MILESTONES = [
  { days: 14, key: "14d", event: "beta_expiring_14d" },
  { days: 7, key: "7d", event: "beta_expiring_7d" },
  { days: 1, key: "1d", event: "beta_expiring_1d" },
] as const satisfies ReadonlyArray<{ days: number; key: string; event: AnalyticsEventName }>;

export async function reconcileBetaGrants(now = new Date()) {
  const starting = await prisma.betaGrant.findMany({
    where: {
      status: BetaGrantStatus.SCHEDULED,
      revokedAt: null,
      startsAt: { lte: now },
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      userId: true,
      campaign: { select: { name: true, durationDays: true } },
    },
  });

  let activated = 0;
  for (const grant of starting) {
    const claimed = await prisma.betaGrant.updateMany({
      where: {
        id: grant.id,
        status: BetaGrantStatus.SCHEDULED,
        revokedAt: null,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      data: { status: BetaGrantStatus.ACTIVE },
    });

    if (claimed.count !== 1) continue;

    activated += 1;
    await trackSafely("beta_started", {
      userId: grant.userId,
      campaign: grant.campaign.name,
      duration_days: grant.campaign.durationDays,
      target_plan: "pro",
    });
  }

  const expired = await prisma.betaGrant.findMany({
    where: {
      status: { in: [BetaGrantStatus.SCHEDULED, BetaGrantStatus.ACTIVE] },
      revokedAt: null,
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      userId: true,
      metadata: true,
      campaign: { select: { name: true, durationDays: true } },
    },
  });

  let expiredCount = 0;
  for (const grant of expired) {
    const claimed = await prisma.betaGrant.updateMany({
      where: {
        id: grant.id,
        status: { in: [BetaGrantStatus.SCHEDULED, BetaGrantStatus.ACTIVE] },
        revokedAt: null,
        expiresAt: { lte: now },
      },
      data: { status: BetaGrantStatus.EXPIRED },
    });

    if (claimed.count !== 1) continue;

    expiredCount += 1;
    await prisma.betaGrant.update({
      where: { id: grant.id },
      data: {
        metadata: {
          ...jsonRecord(grant.metadata),
          reconciledExpiredAt: now.toISOString(),
        } satisfies Prisma.InputJsonValue,
      },
    });
    await trackSafely("beta_expired", {
      userId: grant.userId,
      campaign: grant.campaign.name,
      duration_days: grant.campaign.durationDays,
      target_plan: "pro",
    });
  }

  const reminderCandidates = await prisma.betaGrant.findMany({
    where: {
      status: { in: [BetaGrantStatus.SCHEDULED, BetaGrantStatus.ACTIVE] },
      revokedAt: null,
      startsAt: { lte: now },
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      campaign: { select: { name: true, durationDays: true } },
      user: { select: { name: true, email: true } },
    },
  });

  let remindersRecorded = 0;
  let notificationsSent = 0;
  let notificationFailures = 0;

  for (const grant of reminderCandidates) {
    const daysRemaining = Math.ceil((grant.expiresAt.getTime() - now.getTime()) / MILLISECONDS_PER_DAY);
    const dueMilestones = REMINDER_MILESTONES.filter((milestone) => daysRemaining <= milestone.days);

    for (const milestone of dueMilestones) {
      const claimed = await claimReminderMilestone(grant.id, milestone.key, now);
      if (claimed !== 1) continue;

      remindersRecorded += 1;
      await trackSafely(milestone.event, {
        userId: grant.userId,
        campaign: grant.campaign.name,
        duration_days: grant.campaign.durationDays,
        days_remaining: Math.max(0, daysRemaining),
        target_plan: "pro",
      });

      const notification = await notifyBetaGrantReminder({
        email: grant.user.email,
        name: grant.user.name,
        campaignName: grant.campaign.name,
        daysRemaining: Math.max(0, daysRemaining),
        expiresAt: grant.expiresAt,
      });
      if (notification.delivered) {
        notificationsSent += 1;
      } else if (notification.configured) {
        notificationFailures += 1;
      }
    }
  }

  const exhaustedCampaigns = await detectExhaustedCampaigns();

  return {
    activated,
    expired: expiredCount,
    remindersRecorded,
    notificationsSent,
    notificationFailures,
    exhaustedCampaigns,
    checkedAt: now.toISOString(),
  };
}

async function detectExhaustedCampaigns() {
  const campaigns = await prisma.betaCampaign.findMany({
    where: {
      status: "ACTIVE",
      maxAssignments: { not: null },
    },
    select: { id: true, maxAssignments: true },
  });

  if (campaigns.length === 0) return [];

  const counts = await prisma.betaGrant.groupBy({
    by: ["campaignId"],
    where: {
      campaignId: { in: campaigns.map((campaign) => campaign.id) },
      status: { not: BetaGrantStatus.REVOKED },
    },
    _count: { _all: true },
  });
  const countByCampaign = new Map(counts.map((entry) => [entry.campaignId, entry._count._all]));

  return campaigns
    .filter((campaign) => (countByCampaign.get(campaign.id) ?? 0) >= (campaign.maxAssignments ?? Number.MAX_SAFE_INTEGER))
    .map((campaign) => campaign.id);
}

async function claimReminderMilestone(grantId: string, milestoneKey: string, now: Date) {
  return prisma.$executeRaw`
    UPDATE "beta_grants"
    SET "metadata" = jsonb_set(
      COALESCE("metadata", '{}'::jsonb),
      ARRAY['betaReminderMilestones', ${milestoneKey}]::text[],
      to_jsonb(${now.toISOString()}::text),
      true
    ),
    "updatedAt" = NOW()
    WHERE "id" = ${grantId}
      AND "status" IN ('SCHEDULED', 'ACTIVE')
      AND "revokedAt" IS NULL
      AND COALESCE("metadata", '{}'::jsonb) #> ARRAY['betaReminderMilestones', ${milestoneKey}]::text[] IS NULL
  `;
}

async function trackSafely(name: AnalyticsEventName, payload: { userId: string; [key: string]: string | number | boolean }) {
  await trackServerEvent(name, payload).catch(() => undefined);
}

function jsonRecord(value: Prisma.JsonValue | null): Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}
