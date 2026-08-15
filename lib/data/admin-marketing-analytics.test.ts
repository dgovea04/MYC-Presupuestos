import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    marketingEvent: {
      findMany: vi.fn(),
    },
    billingSubscription: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import {
  getAdminMarketingAnalytics,
  normalizeAdminMarketingDateRange,
} from "@/lib/data/admin-marketing-analytics";

describe("admin marketing analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.billingSubscription.findMany.mockResolvedValue([{ userId: "user-1" }]);
  });

  it("normalizes invalid and oversized date ranges", () => {
    const now = new Date("2026-08-15T14:30:00.000Z");
    const defaultRange = normalizeAdminMarketingDateRange(undefined, undefined, now);

    expect(defaultRange.from.toISOString()).toBe("2026-08-09T00:00:00.000Z");
    expect(defaultRange.to.toISOString()).toBe("2026-08-16T00:00:00.000Z");

    const oversizedRange = normalizeAdminMarketingDateRange("2026-01-01", "2026-08-15", now);
    expect(oversizedRange.to.toISOString()).toBe("2026-08-16T00:00:00.000Z");
    expect(oversizedRange.from.toISOString()).toBe("2026-05-18T00:00:00.000Z");
  });

  it("calculates unique funnel users and attributed activation", async () => {
    prismaMock.marketingEvent.findMany.mockResolvedValue([
      event({ id: "visit-1", name: "landing_view", clientId: "client-1" }),
      event({ id: "visit-2", name: "landing_view", clientId: "client-2" }),
      event({
        id: "signup-1",
        name: "signup_completed",
        userId: "user-1",
        clientId: "client-1",
        firstTouchUtmSource: "google",
        firstTouchUtmMedium: "cpc",
        firstTouchUtmCampaign: "obra-2026",
        firstTouchUtmContent: "video-1",
      }),
      event({
        id: "signup-2",
        name: "signup_completed",
        userId: "user-2",
        clientId: "client-2",
        firstTouchUtmSource: "linkedin",
        firstTouchUtmMedium: "social",
        firstTouchUtmCampaign: "fundadores",
        firstTouchUtmContent: "post-1",
      }),
      event({ id: "activation-1", name: "project_created", userId: "user-1", projectId: "project-1", budgetId: "budget-1", isDemo: false }),
      event({ id: "activation-1b", name: "apu_created", userId: "user-1", budgetId: "budget-1", isDemo: false }),
      event({ id: "demo-1", name: "project_created", userId: "user-2", projectId: "demo-1", isDemo: true }),
      event({ id: "checkout-1", name: "checkout_started", userId: "user-1" }),
      event({ id: "subscription-1", name: "subscription_created", userId: "user-1" }),
    ]);

    const result = await getAdminMarketingAnalytics({
      from: new Date("2026-08-09T00:00:00.000Z"),
      to: new Date("2026-08-16T00:00:00.000Z"),
    });

    expect(result.metrics).toMatchObject({
      visitors: 2,
      signups: 2,
      activated: 1,
      wau: 1,
      wab: 1,
      pro: 1,
      newPro: 1,
      checkoutStarted: 1,
      subscriptionCreated: 1,
    });
    expect(result.rates).toEqual({ signupRate: 100, activationRate: 50, proRate: 100 });
    expect(result.byUtm).toEqual([
      { source: "google", medium: "cpc", campaign: "obra-2026", content: "video-1", signups: 1, activated: 1 },
      { source: "linkedin", medium: "social", campaign: "fundadores", content: "post-1", signups: 1, activated: 0 },
    ]);
  });

  it("identifies the first technical action after signup", async () => {
    prismaMock.marketingEvent.findMany.mockResolvedValue([
      event({ id: "aha-signup-1", name: "signup_completed", userId: "aha-user-1", occurredAt: "2026-08-01T10:00:00.000Z" }),
      event({ id: "aha-signup-2", name: "signup_completed", userId: "aha-user-2", occurredAt: "2026-08-01T11:00:00.000Z" }),
      event({ id: "aha-project", name: "project_created", userId: "aha-user-1", isDemo: false, occurredAt: "2026-08-02T10:00:00.000Z" }),
      event({ id: "aha-budget", name: "budget_created", userId: "aha-user-2", isDemo: false, occurredAt: "2026-08-03T10:00:00.000Z" }),
      event({ id: "aha-later", name: "apu_created", userId: "aha-user-1", isDemo: false, occurredAt: "2026-08-04T10:00:00.000Z" }),
    ]);

    const result = await getAdminMarketingAnalytics({
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-08T00:00:00.000Z"),
    });

    expect(result.ahaMoments).toEqual([
      { eventName: "budget_created", users: 1, activationRate: 50, shareOfActivated: 50 },
      { eventName: "project_created", users: 1, activationRate: 50, shareOfActivated: 50 },
    ]);
  });

  it("calculates weekly retention for mature signup cohorts", async () => {
    prismaMock.marketingEvent.findMany.mockResolvedValue([
      event({ id: "cohort-signup", name: "signup_completed", userId: "cohort-user", clientId: "cohort-client", occurredAt: "2026-06-02T10:00:00.000Z" }),
      event({ id: "cohort-activation", name: "project_created", userId: "cohort-user", isDemo: false, occurredAt: "2026-06-03T10:00:00.000Z" }),
      event({ id: "cohort-w1", name: "apu_created", userId: "cohort-user", isDemo: false, occurredAt: "2026-06-10T10:00:00.000Z" }),
      event({ id: "cohort-w4", name: "export_completed", userId: "cohort-user", isDemo: false, occurredAt: "2026-06-30T10:00:00.000Z" }),
      event({ id: "cohort-w8", name: "formula_created", userId: "cohort-user", isDemo: false, occurredAt: "2026-07-30T10:00:00.000Z" }),
    ]);

    const result = await getAdminMarketingAnalytics({
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-08T00:00:00.000Z"),
    });

    expect(result.cohorts).toEqual([
      expect.objectContaining({
        week: "2026-06-01",
        signups: 1,
        activated: 1,
        activationRate: 100,
        w1: { users: 1, rate: 100 },
        w4: { users: 1, rate: 100 },
        w8: { users: 1, rate: 100 },
      }),
    ]);
  });
});

type EventInput = {
  id: string;
  name: string;
  occurredAt?: string;
  userId?: string;
  clientId?: string;
  projectId?: string;
  budgetId?: string;
  isDemo?: boolean;
  firstTouchUtmSource?: string;
  firstTouchUtmMedium?: string;
  firstTouchUtmCampaign?: string;
  firstTouchUtmContent?: string;
};

function event(input: EventInput) {
  return {
    id: input.id,
    name: input.name,
    occurredAt: new Date(input.occurredAt ?? "2026-08-10T12:00:00.000Z"),
    userId: input.userId ?? null,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    budgetId: input.budgetId ?? null,
    isDemo: input.isDemo ?? null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    firstTouchUtmSource: input.firstTouchUtmSource ?? null,
    firstTouchUtmMedium: input.firstTouchUtmMedium ?? null,
    firstTouchUtmCampaign: input.firstTouchUtmCampaign ?? null,
    firstTouchUtmContent: input.firstTouchUtmContent ?? null,
  };
}
