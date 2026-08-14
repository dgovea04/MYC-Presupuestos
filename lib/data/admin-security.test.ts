import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRawMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

import { getAdminSecurityOverview } from "@/lib/data/admin-security";

describe("admin security overview", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
  });

  it("aggregates recent metrics and flags high activity and multiple IPs", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ totalEvents: 25n, uniqueActors: 2n, uniqueIps: 4n }])
      .mockResolvedValueOnce([{ count: 5n }])
      .mockResolvedValueOnce([{ actorEmail: "admin@example.com", eventCount: 25n, distinctIpCount: 4n }])
      .mockResolvedValueOnce([
        {
          id: "event-1",
          action: "USER_SESSIONS_REVOKED",
          targetEmail: "user@example.com",
          actorEmail: "admin@example.com",
          ipAddress: "127.0.0.1",
          detail: "Sesiones revocadas",
          createdAt: new Date("2026-08-14T12:00:00.000Z"),
        },
      ]);

    const result = await getAdminSecurityOverview(new Date("2026-08-14T12:30:00.000Z"));

    expect(result.metrics).toEqual({ totalEvents: 25, criticalEvents: 5, uniqueActors: 2, uniqueIps: 4 });
    expect(result.signals).toEqual([
      expect.objectContaining({ kind: "HIGH_ACTIVITY", actorEmail: "admin@example.com" }),
      expect.objectContaining({ kind: "MULTIPLE_IPS", actorEmail: "admin@example.com" }),
    ]);
    expect(result.recentEvents[0]).toMatchObject({ action: "USER_SESSIONS_REVOKED", ipAddress: "127.0.0.1" });
  });

  it("returns a clean overview when there are no events", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ totalEvents: 0n, uniqueActors: 0n, uniqueIps: 0n }])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(getAdminSecurityOverview(new Date("2026-08-14T12:30:00.000Z"))).resolves.toMatchObject({
      metrics: { totalEvents: 0, criticalEvents: 0, uniqueActors: 0, uniqueIps: 0 },
      signals: [],
      recentEvents: [],
    });
  });
});
