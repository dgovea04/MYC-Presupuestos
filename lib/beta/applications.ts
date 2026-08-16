import { BetaApplicationStatus, BetaAssignmentMode, BetaCampaignStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { assignBetaGrant } from "@/lib/beta/assignments";
import { persistMarketingEvent } from "@/lib/analytics/store";
import { prisma } from "@/lib/db/prisma";
import { recordAdminAudit } from "@/lib/data/admin-audit";
import { notifyBetaApplicationApproved, notifyBetaApplicationReceived } from "@/lib/beta/notifications";

export const FOUNDING_USERS_CAMPAIGN = "founding-users-peru";
export const FOUNDING_USERS_DURATION_DAYS = 60;

const applicationMetadataSchema = z
  .object({
    utm_source: z.string().trim().max(160).optional(),
    utm_medium: z.string().trim().max(160).optional(),
    utm_campaign: z.string().trim().max(160).optional(),
    utm_content: z.string().trim().max(160).optional(),
    first_touch_utm_source: z.string().trim().max(160).optional(),
    first_touch_utm_medium: z.string().trim().max(160).optional(),
    first_touch_utm_campaign: z.string().trim().max(160).optional(),
    first_touch_utm_content: z.string().trim().max(160).optional(),
    landing_path: z.string().trim().max(160).optional(),
    landing_variant: z.string().trim().max(160).optional(),
    cta_location: z.string().trim().max(160).optional(),
    client_id: z.string().trim().max(160).optional(),
  })
  .strict()
  .default({});

export const betaApplicationInputSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre.").max(120, "El nombre es demasiado largo."),
  email: z.string().trim().email("Ingresa un correo válido.").max(160, "El correo es demasiado largo.").transform((value) => value.toLowerCase()),
  metadata: applicationMetadataSchema.optional(),
});

export type BetaApplicationInput = z.infer<typeof betaApplicationInputSchema>;

export async function createBetaApplication(input: unknown) {
  const parsed = betaApplicationInputSchema.parse(input);
  const existing = await prisma.betaApplication.findFirst({
    where: {
      email: parsed.email,
      campaign: FOUNDING_USERS_CAMPAIGN,
      status: { in: [BetaApplicationStatus.PENDING, BetaApplicationStatus.APPROVED] },
    },
    select: { status: true },
  });

  if (existing) {
    throw new BetaApplicationConflictError();
  }

  let application;
  try {
    application = await prisma.betaApplication.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        campaign: FOUNDING_USERS_CAMPAIGN,
        metadata: parsed.metadata && Object.keys(parsed.metadata).length > 0
          ? (parsed.metadata satisfies Prisma.InputJsonValue)
          : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        campaign: true,
        status: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new BetaApplicationConflictError();
    }
    throw error;
  }

  await persistMarketingEvent({
    name: "pilot_application_submitted",
    clientId: parsed.metadata?.client_id ?? null,
    params: {
      campaign: FOUNDING_USERS_CAMPAIGN,
      landing_path: parsed.metadata?.landing_path,
      landing_variant: parsed.metadata?.landing_variant,
      cta_location: parsed.metadata?.cta_location,
      utm_source: parsed.metadata?.utm_source,
      utm_medium: parsed.metadata?.utm_medium,
      utm_campaign: parsed.metadata?.utm_campaign,
      utm_content: parsed.metadata?.utm_content,
    },
  }).catch(() => undefined);

  await notifyBetaApplicationReceived({
    email: application.email,
    name: application.name,
  }).catch(() => undefined);

  return application;
}

export async function listBetaApplications(status?: BetaApplicationStatus) {
  return prisma.betaApplication.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      campaign: true,
      status: true,
      reviewedAt: true,
      reviewNote: true,
      createdAt: true,
    },
  });
}

export async function reviewBetaApplication(options: {
  applicationId: string;
  reviewerId: string;
  decision: "APPROVE" | "REJECT";
  reviewNote?: string | null;
}) {
  const application = await prisma.betaApplication.findUnique({ where: { id: options.applicationId } });
  if (!application) throw new Error("Solicitud beta no encontrada.");
  if (application.status !== BetaApplicationStatus.PENDING) throw new Error("La solicitud ya fue revisada.");

  if (options.decision === "REJECT") {
    const rejected = await prisma.betaApplication.update({
      where: { id: application.id },
      data: {
        status: BetaApplicationStatus.REJECTED,
        reviewedById: options.reviewerId,
        reviewedAt: new Date(),
        reviewNote: normalizeNote(options.reviewNote),
      },
    });
    await recordAdminAudit({
      actorUserId: options.reviewerId,
      targetUserId: null,
      targetEmail: application.email,
      action: "BETA_APPLICATION_REJECTED",
      detail: normalizeNote(options.reviewNote) ?? "Solicitud beta rechazada.",
      metadata: { applicationId: application.id, campaign: application.campaign },
    });
    return { application: rejected, grant: null };
  }

  const user = await prisma.user.findUnique({
    where: { email: application.email },
    select: { id: true, emailVerifiedAt: true },
  });
  if (!user) {
    throw new Error("El solicitante debe crear y verificar su cuenta con este correo antes de asignar la Beta.");
  }
  if (!user.emailVerifiedAt) {
    throw new Error("El correo del solicitante aún no está verificado.");
  }

  const campaign = await ensureFoundingUsersCampaign(options.reviewerId);
  const grant = await assignBetaGrant({
    campaignId: campaign.id,
    userId: user.id,
    source: "ADMIN",
    assignedById: options.reviewerId,
    reason: options.reviewNote ?? "Solicitud aprobada: Usuarios Fundadores Perú.",
  });
  const approved = await prisma.betaApplication.update({
    where: { id: application.id },
    data: {
      status: BetaApplicationStatus.APPROVED,
      reviewedById: options.reviewerId,
      reviewedAt: new Date(),
      reviewNote: normalizeNote(options.reviewNote),
    },
  });

  await recordAdminAudit({
    actorUserId: options.reviewerId,
    targetUserId: user.id,
    targetEmail: application.email,
    action: "BETA_APPLICATION_APPROVED",
    detail: normalizeNote(options.reviewNote) ?? "Solicitud beta aprobada y acceso Pro temporal asignado.",
    metadata: { applicationId: application.id, campaignId: campaign.id, grantId: grant.grantId },
  });

  await notifyBetaApplicationApproved({
    email: application.email,
    name: application.name,
  }).catch(() => undefined);

  return { application: approved, grant };
}

export async function ensureFoundingUsersCampaign(createdById: string) {
  const existing = await prisma.betaCampaign.findUnique({ where: { code: FOUNDING_USERS_CAMPAIGN } });
  if (existing) {
    if (existing.status === BetaCampaignStatus.DRAFT || existing.status === BetaCampaignStatus.PAUSED) {
      return prisma.betaCampaign.update({
        where: { id: existing.id },
        data: { status: BetaCampaignStatus.ACTIVE, startsAt: existing.startsAt > new Date() ? new Date() : existing.startsAt },
      });
    }
    if (existing.status === BetaCampaignStatus.FINISHED) throw new Error("La campaña Usuarios Fundadores Perú ya finalizó.");
    return existing;
  }

  return prisma.betaCampaign.create({
    data: {
      name: "Usuarios Fundadores Perú",
      code: FOUNDING_USERS_CAMPAIGN,
      planSlug: "pro",
      durationDays: FOUNDING_USERS_DURATION_DAYS,
      status: BetaCampaignStatus.ACTIVE,
      assignmentMode: BetaAssignmentMode.ADMIN,
      startsAt: new Date(),
      maxAssignments: null,
      eligibilityRules: {
        requireVerifiedEmail: true,
        newUsersOnly: false,
        allowedUtmSources: [],
        allowedUtmCampaigns: [],
        allowedEmailDomains: [],
        requiresCode: false,
        excludePaidSubscribers: true,
        excludePreviousBetaUsers: true,
      } satisfies Prisma.InputJsonValue,
      createdById,
    },
  });
}

export class BetaApplicationConflictError extends Error {
  constructor() {
    super("Ya existe una solicitud activa para este correo.");
    this.name = "BetaApplicationConflictError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function normalizeNote(value: string | null | undefined) {
  const normalized = value?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 500);
  return normalized || null;
}
