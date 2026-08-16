import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
  grantFindFirst: vi.fn(),
  grantFindUnique: vi.fn(),
  marketingFindFirst: vi.fn(),
  grantCount: vi.fn(),
  grantCreate: vi.fn(),
  audit: vi.fn(),
  activeBeta: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    betaCampaign: { findUnique: mocks.campaignFindUnique },
    user: { findUnique: mocks.userFindUnique },
    billingSubscription: { findFirst: mocks.subscriptionFindFirst },
    betaGrant: {
      findFirst: mocks.grantFindFirst,
      findUnique: mocks.grantFindUnique,
    },
    marketingEvent: { findFirst: mocks.marketingFindFirst },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/data/admin-audit", () => ({
  recordAdminAudit: mocks.audit,
}));

vi.mock("@/lib/beta/access", () => ({
  getActiveBetaAccess: mocks.activeBeta,
}));

import { assignBetaGrant, evaluateBetaEligibility } from "@/lib/beta/assignments";

describe("beta assignments", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.activeBeta.mockResolvedValue(null);
    mocks.subscriptionFindFirst.mockResolvedValue(null);
    mocks.grantFindFirst.mockResolvedValue(null);
    mocks.grantFindUnique.mockResolvedValue(null);
    mocks.marketingFindFirst.mockResolvedValue(null);
    mocks.audit.mockResolvedValue(undefined);
  });

  it("rejects an unverified user when required", async () => {
    mocks.campaignFindUnique.mockResolvedValue({
      id: "campaign-1",
      status: "ACTIVE",
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      endsAt: null,
      eligibilityRules: { requireVerifiedEmail: true, excludePaidSubscribers: true, excludePreviousBetaUsers: true },
    });
    mocks.userFindUnique.mockResolvedValue({
      email: "user@example.com",
      emailVerifiedAt: null,
      status: "ACTIVE",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    const result = await evaluateBetaEligibility({ campaignId: "campaign-1", userId: "user-1", now: new Date("2026-08-02T00:00:00.000Z") });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("EMAIL_NOT_VERIFIED");
  });

  it("returns an existing grant without creating a duplicate", async () => {
    const startsAt = new Date("2026-08-01T00:00:00.000Z");
    const expiresAt = new Date("2026-09-30T00:00:00.000Z");
    mocks.grantFindUnique.mockResolvedValue({ id: "grant-1", startsAt, expiresAt });

    await expect(assignBetaGrant({ campaignId: "campaign-1", userId: "user-1", source: "ADMIN" })).resolves.toEqual({
      grantId: "grant-1",
      created: false,
      startsAt,
      expiresAt,
    });
    expect(mocks.campaignFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
