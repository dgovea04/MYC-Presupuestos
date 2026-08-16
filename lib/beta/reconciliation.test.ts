import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  grantFindMany: vi.fn(),
  grantUpdateMany: vi.fn(),
  grantUpdate: vi.fn(),
  grantGroupBy: vi.fn(),
  campaignFindMany: vi.fn(),
  executeRaw: vi.fn(),
  trackServerEvent: vi.fn(),
  notifyBetaGrantReminder: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    betaGrant: {
      findMany: mocks.grantFindMany,
      updateMany: mocks.grantUpdateMany,
      update: mocks.grantUpdate,
      groupBy: mocks.grantGroupBy,
    },
    betaCampaign: {
      findMany: mocks.campaignFindMany,
    },
    $executeRaw: mocks.executeRaw,
  },
}));
vi.mock("@/lib/analytics/events", () => ({ trackServerEvent: mocks.trackServerEvent }));
vi.mock("@/lib/beta/notifications", () => ({ notifyBetaGrantReminder: mocks.notifyBetaGrantReminder }));

import { reconcileBetaGrants } from "@/lib/beta/reconciliation";

describe("beta reconciliation", () => {
  const now = new Date("2026-08-15T08:00:00.000Z");

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.grantUpdateMany.mockResolvedValue({ count: 1 });
    mocks.grantUpdate.mockResolvedValue({});
    mocks.executeRaw.mockResolvedValue(1);
    mocks.campaignFindMany.mockResolvedValue([]);
    mocks.grantGroupBy.mockResolvedValue([]);
    mocks.trackServerEvent.mockResolvedValue(undefined);
    mocks.notifyBetaGrantReminder.mockResolvedValue({ configured: false, delivered: false });
  });

  it("activates grants and records the 14-day reminder once", async () => {
    mocks.grantFindMany
      .mockResolvedValueOnce([
        { id: "grant-1", userId: "user-1", campaign: { name: "Piloto", durationDays: 60 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "grant-1",
          userId: "user-1",
          expiresAt: new Date("2026-08-29T08:00:00.000Z"),
          campaign: { name: "Piloto", durationDays: 60 },
          user: { name: "Ana", email: "ana@example.com" },
        },
      ]);

    const result = await reconcileBetaGrants(now);

    expect(result).toMatchObject({
      activated: 1,
      expired: 0,
      remindersRecorded: 1,
      notificationsSent: 0,
      notificationFailures: 0,
      exhaustedCampaigns: [],
    });
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("beta_started", expect.objectContaining({ userId: "user-1" }));
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("beta_expiring_14d", expect.objectContaining({ days_remaining: 14 }));
    expect(mocks.executeRaw).toHaveBeenCalledOnce();
    expect(mocks.notifyBetaGrantReminder).toHaveBeenCalledWith(expect.objectContaining({ daysRemaining: 14 }));
  });

  it("expires a grant without deleting existing metadata", async () => {
    mocks.grantFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "grant-1",
          userId: "user-1",
          metadata: { reason: "Piloto interno" },
          campaign: { name: "Piloto", durationDays: 60 },
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await reconcileBetaGrants(now);

    expect(result.expired).toBe(1);
    expect(mocks.grantUpdate).toHaveBeenCalledWith({
      where: { id: "grant-1" },
      data: {
        metadata: {
          reason: "Piloto interno",
          reconciledExpiredAt: now.toISOString(),
        },
      },
    });
    expect(mocks.trackServerEvent).toHaveBeenCalledWith("beta_expired", expect.objectContaining({ userId: "user-1" }));
  });

  it("detects active campaigns that reached their assignment limit", async () => {
    mocks.grantFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mocks.campaignFindMany.mockResolvedValue([{ id: "campaign-1", maxAssignments: 2 }]);
    mocks.grantGroupBy.mockResolvedValue([{ campaignId: "campaign-1", _count: { _all: 2 } }]);

    const result = await reconcileBetaGrants(now);

    expect(result.exhaustedCampaigns).toEqual(["campaign-1"]);
    expect(mocks.grantGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ campaignId: { in: ["campaign-1"] } }),
    }));
  });

  it("does not notify when another reconciliation already claimed the milestone", async () => {
    mocks.executeRaw.mockResolvedValue(0);
    mocks.grantFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "grant-1",
          userId: "user-1",
          expiresAt: new Date("2026-08-29T08:00:00.000Z"),
          campaign: { name: "Piloto", durationDays: 60 },
          user: { name: "Ana", email: "ana@example.com" },
        },
      ]);

    const result = await reconcileBetaGrants(now);

    expect(result.remindersRecorded).toBe(0);
    expect(mocks.notifyBetaGrantReminder).not.toHaveBeenCalled();
    expect(mocks.trackServerEvent).not.toHaveBeenCalled();
  });
});
