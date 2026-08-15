import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    marketingEvent: { findMany: vi.fn() },
    user: { count: vi.fn() },
    project: { count: vi.fn() },
    budget: { count: vi.fn() },
    billingSubscription: { count: vi.fn() },
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import { getAdminMarketingReconciliation } from "@/lib/data/admin-marketing-reconciliation";

describe("admin marketing reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.marketingEvent.findMany.mockResolvedValue([
      { id: "signup-1", name: "signup_completed", userId: "user-1", clientId: "client-1", projectId: null, budgetId: null, isDemo: null },
      { id: "project-1", name: "project_created", userId: "user-1", clientId: null, projectId: "project-1", budgetId: null, isDemo: false },
      { id: "budget-1", name: "budget_created", userId: "user-1", clientId: null, projectId: "project-1", budgetId: "budget-1", isDemo: false },
      { id: "subscription-1", name: "subscription_created", userId: "user-1", clientId: null, projectId: null, budgetId: null, isDemo: null },
    ]);
    prismaMock.user.count.mockResolvedValue(1);
    prismaMock.project.count.mockResolvedValue(1);
    prismaMock.budget.count.mockResolvedValue(2);
    prismaMock.billingSubscription.count.mockResolvedValue(1);
  });

  it("marks matching sources and exposes differences for review", async () => {
    const result = await getAdminMarketingReconciliation({
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-08T00:00:00.000Z"),
    });

    expect(result.available).toBe(true);
    expect(result.rows).toEqual([
      expect.objectContaining({ key: "signup_completed", internalCount: 1, sourceCount: 1, difference: 0, status: "match" }),
      expect.objectContaining({ key: "project_created", internalCount: 1, sourceCount: 1, difference: 0, status: "match" }),
      expect.objectContaining({ key: "budget_created", internalCount: 1, sourceCount: 2, difference: -1, status: "review" }),
      expect.objectContaining({ key: "subscription_created", internalCount: 1, sourceCount: 1, difference: 0, status: "match" }),
    ]);
  });

  it("fails soft when the analytics table cannot be queried", async () => {
    prismaMock.marketingEvent.findMany.mockRejectedValue(new Error("table unavailable"));

    const result = await getAdminMarketingReconciliation({
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-08T00:00:00.000Z"),
    });

    expect(result.available).toBe(false);
    expect(result.rows).toEqual([]);
  });
});
