import { describe, expect, it } from "vitest";
import { calculateBetaAnalytics, type BetaAnalyticsEvent, type BetaAnalyticsGrant } from "@/lib/data/admin-beta-analytics";

const range = {
  from: new Date("2026-08-01T00:00:00.000Z"),
  to: new Date("2026-09-01T00:00:00.000Z"),
};

describe("beta analytics", () => {
  it("calculates activation and conversion by campaign", () => {
    const grants: BetaAnalyticsGrant[] = [
      {
        campaignId: "campaign-60",
        campaignName: "Piloto 60",
        durationDays: 60,
        userId: "user-1",
        createdAt: new Date("2026-08-02T00:00:00.000Z"),
        startsAt: new Date("2026-08-02T00:00:00.000Z"),
        expiresAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      {
        campaignId: "campaign-60",
        campaignName: "Piloto 60",
        durationDays: 60,
        userId: "user-2",
        createdAt: new Date("2026-08-03T00:00:00.000Z"),
        startsAt: new Date("2026-08-03T00:00:00.000Z"),
        expiresAt: new Date("2026-10-02T00:00:00.000Z"),
      },
    ];
    const events: BetaAnalyticsEvent[] = [
      { name: "beta_eligible", userId: "user-1", campaign: "Piloto 60", occurredAt: new Date("2026-08-03T00:00:00.000Z") },
      { name: "beta_started", userId: "user-1", occurredAt: new Date("2026-08-04T00:00:00.000Z") },
      { name: "beta_upgrade_clicked", userId: "user-1", occurredAt: new Date("2026-08-05T00:00:00.000Z") },
      { name: "subscription_created", userId: "user-1", occurredAt: new Date("2026-08-06T00:00:00.000Z") },
    ];

    const result = calculateBetaAnalytics(range, grants, events);

    expect(result.metrics).toMatchObject({
      eligible: 1,
      assigned: 2,
      activated: 1,
      activationRate: 50,
      upgradeClicked: 1,
      converted: 1,
      conversionRate: 50,
    });
    expect(result.byCampaign[0]).toMatchObject({
      campaignId: "campaign-60",
      durationDays: 60,
      eligible: 1,
      assigned: 2,
      activated: 1,
      converted: 1,
    });
  });

  it("calculates retention and post-expiry conversion windows", () => {
    const grants: BetaAnalyticsGrant[] = [
      {
        campaignId: "campaign-60",
        campaignName: "Piloto 60",
        durationDays: 60,
        userId: "user-1",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        startsAt: new Date("2026-08-01T00:00:00.000Z"),
        expiresAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      {
        campaignId: "campaign-60",
        campaignName: "Piloto 60",
        durationDays: 60,
        userId: "user-2",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        startsAt: new Date("2026-08-01T00:00:00.000Z"),
        expiresAt: new Date("2026-10-01T00:00:00.000Z"),
      },
    ];
    const events: BetaAnalyticsEvent[] = [
      { name: "beta_feature_used", userId: "user-1", occurredAt: new Date("2026-08-09T00:00:00.000Z") },
      { name: "beta_feature_used", userId: "user-1", occurredAt: new Date("2026-08-30T00:00:00.000Z") },
      { name: "beta_feature_used", userId: "user-1", occurredAt: new Date("2026-09-27T00:00:00.000Z") },
      { name: "subscription_created", userId: "user-1", occurredAt: new Date("2026-10-04T00:00:00.000Z") },
      { name: "subscription_created", userId: "user-2", occurredAt: new Date("2026-10-12T00:00:00.000Z") },
    ];

    const result = calculateBetaAnalytics(range, grants, events, new Date("2026-10-20T00:00:00.000Z"));
    const campaign = result.byCampaign[0];

    expect(campaign?.retention).toMatchObject({
      w1: { users: 1, rate: 50 },
      w4: { users: 1, rate: 50 },
      w8: { users: 1, rate: 50 },
    });
    expect(campaign?.conversionWindows).toMatchObject({
      duringBeta: { users: 0, rate: 0 },
      postExpiry0To7d: { users: 1, rate: 50 },
      postExpiry8To14d: { users: 1, rate: 50 },
    });
    expect(result.metrics).toMatchObject({ converted: 2, expiredWithoutConversion: 0 });
  });
});
