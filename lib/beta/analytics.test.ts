import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  grantFindFirst: vi.fn(),
  activeAccess: vi.fn(),
  trackServerEvent: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { betaGrant: { findFirst: mocks.grantFindFirst } },
}));
vi.mock("@/lib/beta/access", () => ({ getActiveBetaAccess: mocks.activeAccess }));
vi.mock("@/lib/analytics/events", () => ({ trackServerEvent: mocks.trackServerEvent }));

import {
  trackBetaCheckoutStarted,
  trackBetaConversion,
  trackBetaEligible,
  trackBetaFeatureUsed,
} from "@/lib/beta/analytics";

describe("beta analytics instrumentation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.trackServerEvent.mockResolvedValue(undefined);
    mocks.activeAccess.mockResolvedValue({
      campaignName: "Piloto 60",
      grantSource: "ADMIN",
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: new Date("2026-09-30T00:00:00.000Z"),
      daysRemaining: 45,
    });
  });

  it("records eligibility with only safe campaign parameters", async () => {
    await trackBetaEligible({ userId: "user-1", campaignName: "Piloto 60", durationDays: 60 });

    expect(mocks.trackServerEvent).toHaveBeenCalledWith("beta_eligible", {
      userId: "user-1",
      campaign: "Piloto 60",
      duration_days: 60,
      target_plan: "pro",
    });
  });

  it("records feature usage and checkout only for active beta access", async () => {
    await expect(trackBetaFeatureUsed({ userId: "user-1", feature: "ai.local", companyId: "company-1" })).resolves.toBe(true);
    await expect(trackBetaCheckoutStarted({ userId: "user-1", companyId: "company-1" })).resolves.toBe(true);

    expect(mocks.trackServerEvent).toHaveBeenCalledWith("beta_feature_used", expect.objectContaining({
      campaign: "Piloto 60",
      feature: "ai.local",
      grant_source: "ADMIN",
    }));
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("beta_checkout_started", expect.objectContaining({
      conversion_window: "during_beta",
    }));
  });

  it("attributes a Stripe subscription to a post-expiry beta window", async () => {
    mocks.grantFindFirst.mockResolvedValue({
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: new Date("2026-09-30T00:00:00.000Z"),
      source: "ADMIN",
      campaign: { name: "Piloto 60", durationDays: 60 },
    });

    await expect(trackBetaConversion("user-1", new Date("2026-10-04T00:00:00.000Z"))).resolves.toBe(true);

    expect(mocks.trackServerEvent).toHaveBeenCalledWith("beta_converted", expect.objectContaining({
      campaign: "Piloto 60",
      conversion_window: "post_expiry_0_7d",
    }));
  });
});
