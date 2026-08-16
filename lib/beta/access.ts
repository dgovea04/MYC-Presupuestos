import { BetaGrantStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ActiveBetaAccess } from "@/lib/beta/types";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getActiveBetaAccess(options: {
  userId: string;
  companyId?: string | null;
  now?: Date;
}): Promise<ActiveBetaAccess | null> {
  const now = options.now ?? new Date();
  const grant = await prisma.betaGrant.findFirst({
    where: {
      userId: options.userId,
      revokedAt: null,
      startsAt: { lte: now },
      expiresAt: { gt: now },
      ...(options.companyId
        ? { OR: [{ companyId: options.companyId }, { companyId: null }] }
        : { companyId: null }),
    },
    orderBy: { expiresAt: "desc" },
    select: {
      id: true,
      campaignId: true,
      planSlug: true,
      source: true,
      startsAt: true,
      expiresAt: true,
      status: true,
      campaign: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!grant || grant.status === BetaGrantStatus.REVOKED || grant.planSlug !== "pro") {
    return null;
  }

  return {
    grantId: grant.id,
    campaignId: grant.campaignId,
    campaignName: grant.campaign.name,
    planSlug: "pro",
    grantSource: grant.source,
    startsAt: grant.startsAt,
    expiresAt: grant.expiresAt,
    daysRemaining: Math.max(1, Math.ceil((grant.expiresAt.getTime() - now.getTime()) / MILLISECONDS_PER_DAY)),
  };
}

export function isBetaAccessActive(license: {
  accessSource?: string;
  betaExpiresAt?: string | null;
}, now = new Date()) {
  return license.accessSource !== "BETA" || !license.betaExpiresAt || new Date(license.betaExpiresAt).getTime() > now.getTime();
}
