import { beforeEach, describe, expect, it, vi } from "vitest";
import { BetaApplicationStatus, BetaCampaignStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  betaApplicationFindFirst: vi.fn(),
  betaApplicationCreate: vi.fn(),
  betaApplicationFindMany: vi.fn(),
  betaApplicationFindUnique: vi.fn(),
  betaApplicationUpdate: vi.fn(),
  betaCampaignFindUnique: vi.fn(),
  betaCampaignUpdate: vi.fn(),
  betaCampaignCreate: vi.fn(),
  userFindUnique: vi.fn(),
  assignBetaGrant: vi.fn(),
  persistMarketingEvent: vi.fn(),
  recordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    betaApplication: {
      findFirst: mocks.betaApplicationFindFirst,
      create: mocks.betaApplicationCreate,
      findMany: mocks.betaApplicationFindMany,
      findUnique: mocks.betaApplicationFindUnique,
      update: mocks.betaApplicationUpdate,
    },
    betaCampaign: {
      findUnique: mocks.betaCampaignFindUnique,
      update: mocks.betaCampaignUpdate,
      create: mocks.betaCampaignCreate,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

vi.mock("@/lib/beta/assignments", () => ({ assignBetaGrant: mocks.assignBetaGrant }));
vi.mock("@/lib/analytics/store", () => ({ persistMarketingEvent: mocks.persistMarketingEvent }));
vi.mock("@/lib/data/admin-audit", () => ({ recordAdminAudit: mocks.recordAdminAudit }));

import {
  BetaApplicationConflictError,
  FOUNDING_USERS_CAMPAIGN,
  createBetaApplication,
  ensureFoundingUsersCampaign,
  reviewBetaApplication,
} from "@/lib/beta/applications";

describe("beta application service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.persistMarketingEvent.mockResolvedValue(undefined);
    mocks.recordAdminAudit.mockResolvedValue(undefined);
  });

  it("creates a pending application with normalized email and attribution metadata", async () => {
    mocks.betaApplicationFindFirst.mockResolvedValue(null);
    mocks.betaApplicationCreate.mockResolvedValue({
      id: "application-1",
      name: "María Calderón",
      email: "maria@example.com",
      campaign: FOUNDING_USERS_CAMPAIGN,
      status: BetaApplicationStatus.PENDING,
      createdAt: new Date("2026-08-16T10:00:00.000Z"),
    });

    const result = await createBetaApplication({
      name: "María Calderón",
      email: " MARIA@EXAMPLE.COM ",
      metadata: {
        landing_path: "/software-presupuestos-construccion",
        cta_location: "acquisition_hero",
      },
    });

    expect(result.id).toBe("application-1");
    expect(mocks.betaApplicationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "María Calderón",
        email: "maria@example.com",
        campaign: FOUNDING_USERS_CAMPAIGN,
      }),
    }));
    expect(mocks.persistMarketingEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "pilot_application_submitted",
      params: expect.objectContaining({ campaign: FOUNDING_USERS_CAMPAIGN }),
    }));
  });

  it("blocks a second pending or approved application for the same campaign and email", async () => {
    mocks.betaApplicationFindFirst.mockResolvedValue({ status: BetaApplicationStatus.PENDING });

    await expect(createBetaApplication({ name: "María Calderón", email: "maria@example.com" })).rejects.toBeInstanceOf(
      BetaApplicationConflictError,
    );
    expect(mocks.betaApplicationCreate).not.toHaveBeenCalled();
  });

  it("rejects a pending application and records administrative audit", async () => {
    const pending = {
      id: "application-1",
      email: "maria@example.com",
      campaign: FOUNDING_USERS_CAMPAIGN,
      status: BetaApplicationStatus.PENDING,
    };
    mocks.betaApplicationFindUnique.mockResolvedValue(pending);
    mocks.betaApplicationUpdate.mockResolvedValue({ ...pending, status: BetaApplicationStatus.REJECTED });

    const result = await reviewBetaApplication({
      applicationId: "application-1",
      reviewerId: "super-admin-1",
      decision: "REJECT",
      reviewNote: "No cumple los criterios del piloto.",
    });

    expect(result.grant).toBeNull();
    expect(mocks.betaApplicationUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "application-1" },
      data: expect.objectContaining({ status: BetaApplicationStatus.REJECTED, reviewedById: "super-admin-1" }),
    }));
    expect(mocks.recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "BETA_APPLICATION_REJECTED",
      targetEmail: "maria@example.com",
    }));
  });

  it("requires an existing verified account before assigning Pro access", async () => {
    mocks.betaApplicationFindUnique.mockResolvedValue({
      id: "application-1",
      email: "maria@example.com",
      campaign: FOUNDING_USERS_CAMPAIGN,
      status: BetaApplicationStatus.PENDING,
    });
    mocks.userFindUnique.mockResolvedValue(null);

    await expect(reviewBetaApplication({
      applicationId: "application-1",
      reviewerId: "super-admin-1",
      decision: "APPROVE",
    })).rejects.toThrow(/crear y verificar su cuenta/i);
    expect(mocks.assignBetaGrant).not.toHaveBeenCalled();
    expect(mocks.betaApplicationUpdate).not.toHaveBeenCalled();
  });

  it("creates the 60-day founding campaign and assigns a Pro grant on approval", async () => {
    const pending = {
      id: "application-1",
      email: "maria@example.com",
      campaign: FOUNDING_USERS_CAMPAIGN,
      status: BetaApplicationStatus.PENDING,
    };
    const campaign = {
      id: "campaign-1",
      code: FOUNDING_USERS_CAMPAIGN,
      name: "Usuarios Fundadores Perú",
      status: BetaCampaignStatus.ACTIVE,
      durationDays: 60,
    };
    mocks.betaApplicationFindUnique.mockResolvedValue(pending);
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", emailVerifiedAt: new Date() });
    mocks.betaCampaignFindUnique.mockResolvedValue(null);
    mocks.betaCampaignCreate.mockResolvedValue(campaign);
    mocks.assignBetaGrant.mockResolvedValue({ grantId: "grant-1", created: true });
    mocks.betaApplicationUpdate.mockResolvedValue({ ...pending, status: BetaApplicationStatus.APPROVED });

    const result = await reviewBetaApplication({
      applicationId: "application-1",
      reviewerId: "super-admin-1",
      decision: "APPROVE",
      reviewNote: "Validado para el piloto.",
    });

    expect(mocks.betaCampaignCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        code: FOUNDING_USERS_CAMPAIGN,
        durationDays: 60,
        status: BetaCampaignStatus.ACTIVE,
      }),
    }));
    expect(mocks.assignBetaGrant).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      userId: "user-1",
      source: "ADMIN",
      assignedById: "super-admin-1",
      reason: "Validado para el piloto.",
    });
    expect(result.grant).toEqual({ grantId: "grant-1", created: true });
    expect(mocks.recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "BETA_APPLICATION_APPROVED",
      targetUserId: "user-1",
      metadata: expect.objectContaining({ campaignId: "campaign-1", grantId: "grant-1" }),
    }));
  });

  it("reactivates an existing paused founding campaign instead of duplicating it", async () => {
    const campaign = {
      id: "campaign-1",
      code: FOUNDING_USERS_CAMPAIGN,
      status: BetaCampaignStatus.PAUSED,
      startsAt: new Date("2026-08-20T00:00:00.000Z"),
    };
    mocks.betaCampaignFindUnique.mockResolvedValue(campaign);
    mocks.betaCampaignUpdate.mockResolvedValue({ ...campaign, status: BetaCampaignStatus.ACTIVE });

    const result = await ensureFoundingUsersCampaign("super-admin-1");

    expect(result.status).toBe(BetaCampaignStatus.ACTIVE);
    expect(mocks.betaCampaignCreate).not.toHaveBeenCalled();
    expect(mocks.betaCampaignUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "campaign-1" },
      data: expect.objectContaining({ status: BetaCampaignStatus.ACTIVE }),
    }));
  });
});
