import { BetaAssignmentMode, BetaCampaignStatus, BetaGrantSource, BetaGrantStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { betaCampaignInputSchema } from "@/lib/beta/validation";
import type { BetaCampaignInput } from "@/lib/beta/validation";

const STATUS_TRANSITIONS: Record<BetaCampaignStatus, readonly BetaCampaignStatus[]> = {
  DRAFT: [BetaCampaignStatus.ACTIVE, BetaCampaignStatus.FINISHED],
  ACTIVE: [BetaCampaignStatus.PAUSED, BetaCampaignStatus.FINISHED],
  PAUSED: [BetaCampaignStatus.ACTIVE, BetaCampaignStatus.FINISHED],
  FINISHED: [],
};

export async function createBetaCampaign(input: unknown, createdById: string) {
  const data = betaCampaignInputSchema.parse(input);

  return prisma.betaCampaign.create({
    data: {
      name: data.name,
      code: data.code ?? null,
      planSlug: "pro",
      durationDays: data.durationDays,
      assignmentMode: data.assignmentMode as BetaAssignmentMode,
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
      maxAssignments: data.maxAssignments ?? null,
      eligibilityRules: data.eligibilityRules as Prisma.InputJsonValue,
      createdById,
    },
  });
}

export async function updateBetaCampaign(
  campaignId: string,
  input: Partial<BetaCampaignInput>,
) {
  const current = await prisma.betaCampaign.findUnique({ where: { id: campaignId } });

  if (!current) {
    throw new Error("Campaña beta no encontrada.");
  }

  if (current.status !== BetaCampaignStatus.DRAFT) {
    throw new Error("Solo se pueden editar campañas en borrador.");
  }

  const parsed = betaCampaignInputSchema.parse({
    name: input.name ?? current.name,
    code: input.code ?? current.code,
    durationDays: input.durationDays ?? current.durationDays,
    assignmentMode: input.assignmentMode ?? current.assignmentMode,
    startsAt: input.startsAt ?? current.startsAt,
    endsAt: input.endsAt === undefined ? current.endsAt : input.endsAt,
    maxAssignments: input.maxAssignments === undefined ? current.maxAssignments : input.maxAssignments,
    eligibilityRules: input.eligibilityRules ?? current.eligibilityRules,
  });

  return prisma.betaCampaign.update({
    where: { id: campaignId },
    data: {
      name: parsed.name,
      code: parsed.code ?? null,
      durationDays: parsed.durationDays,
      assignmentMode: parsed.assignmentMode as BetaAssignmentMode,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt ?? null,
      maxAssignments: parsed.maxAssignments ?? null,
      eligibilityRules: parsed.eligibilityRules as Prisma.InputJsonValue,
    },
  });
}

export async function getBetaCampaignDetail(campaignId: string) {
  return prisma.betaCampaign.findUnique({
    where: { id: campaignId },
    include: {
      grants: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          userId: true,
          companyId: true,
          status: true,
          source: true,
          startsAt: true,
          expiresAt: true,
          revokedAt: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });
}

export const BETA_GRANTS_PAGE_SIZE = 25;
export const BETA_GRANTS_EXPORT_PAGE_SIZE = 5_000;

export type BetaGrantListFilters = {
  campaignId: string;
  query?: string;
  status?: BetaGrantStatus;
  source?: BetaGrantSource;
  page?: number;
  pageSize?: number;
};

export async function listBetaGrants(filters: BetaGrantListFilters) {
  const page = Number.isInteger(filters.page) && filters.page && filters.page > 0 ? filters.page : 1;
  const requestedPageSize = Number.isInteger(filters.pageSize) && filters.pageSize && filters.pageSize > 0
    ? filters.pageSize
    : BETA_GRANTS_PAGE_SIZE;
  const pageSize = Math.min(BETA_GRANTS_EXPORT_PAGE_SIZE, requestedPageSize);
  const query = filters.query?.trim().slice(0, 100) || undefined;
  const where: Prisma.BetaGrantWhereInput = {
    campaignId: filters.campaignId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(query
      ? {
          OR: [
            { id: { contains: query, mode: "insensitive" } },
            { userId: { contains: query, mode: "insensitive" } },
            { user: { name: { contains: query, mode: "insensitive" } } },
            { user: { email: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [grants, total] = await Promise.all([
    prisma.betaGrant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        userId: true,
        companyId: true,
        status: true,
        source: true,
        startsAt: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.betaGrant.count({ where }),
  ]);

  return {
    grants,
    pagination: {
      page: Math.min(page, Math.max(1, Math.ceil(total / pageSize))),
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    filters: {
      query: query ?? "",
      status: filters.status ?? "",
      source: filters.source ?? "",
    },
  };
}

export async function transitionBetaCampaign(campaignId: string, status: BetaCampaignStatus) {
  const current = await prisma.betaCampaign.findUnique({ where: { id: campaignId } });

  if (!current) {
    throw new Error("Campaña beta no encontrada.");
  }

  if (!STATUS_TRANSITIONS[current.status].includes(status)) {
    throw new Error(`No se puede cambiar una campaña de ${current.status} a ${status}.`);
  }

  return prisma.betaCampaign.update({
    where: { id: campaignId },
    data: { status },
  });
}

export async function listBetaCampaigns(options: {
  status?: BetaCampaignStatus;
  page?: number;
  pageSize?: number;
} = {}) {
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
  const page = Math.max(1, options.page ?? 1);
  const where = options.status ? { status: options.status } : {};
  const [campaigns, total] = await Promise.all([
    prisma.betaCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { grants: true } },
      },
    }),
    prisma.betaCampaign.count({ where }),
  ]);

  return {
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      assignedCount: campaign._count.grants,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
