import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    marketingEvent: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import { getAdminMarketingHealth } from "@/lib/data/admin-marketing-health";

describe("admin marketing health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts missing attribution and possible duplicates", async () => {
    const occurredAt = new Date("2026-08-15T10:00:00.000Z");
    prismaMock.marketingEvent.findMany.mockResolvedValue([
      { id: "landing-1", name: "landing_view", userId: null, clientId: "client-1", utmSource: null, firstTouchUtmSource: null, occurredAt },
      { id: "signup-1", name: "signup_completed", userId: "user-1", clientId: "client-1", utmSource: null, firstTouchUtmSource: null, occurredAt },
      { id: "signup-2", name: "signup_completed", userId: "user-1", clientId: "client-1", utmSource: "google", firstTouchUtmSource: "google", occurredAt },
    ]);

    const result = await getAdminMarketingHealth({
      from: new Date("2026-08-15T00:00:00.000Z"),
      to: new Date("2026-08-16T00:00:00.000Z"),
    });

    expect(result.available).toBe(true);
    expect(result.totalEvents).toBe(3);
    expect(result.anonymousEvents).toBe(1);
    expect(result.unattributedSignups).toBe(1);
    expect(result.possibleDuplicates).toBe(1);
    expect(result.lastEventAt).toBe(occurredAt.toISOString());
    expect(result.eventCounts[0]).toEqual({ name: "signup_completed", count: 2 });
    expect(result.missingCoreEvents).toContain("subscription_created");
  });

  it("fails soft when the table cannot be read", async () => {
    prismaMock.marketingEvent.findMany.mockRejectedValue(new Error("database unavailable"));

    const result = await getAdminMarketingHealth({
      from: new Date("2026-08-15T00:00:00.000Z"),
      to: new Date("2026-08-16T00:00:00.000Z"),
    });

    expect(result.available).toBe(false);
    expect(result.totalEvents).toBe(0);
  });
});
