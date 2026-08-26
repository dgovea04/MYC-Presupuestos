import { describe, expect, it, vi } from "vitest";
import { getWorkspaceUsage } from "@/lib/workspace/usage";

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    name: "Pro",
    slug: "pro",
    monthlyTokenLimit: 500000,
    workspaceAiTokenLimit: 400000,
    monthlyBudgetMinor: 15000,
    seatLimit: 10,
    billingMode: "STRIPE",
    projectLimit: null,
    budgetLimit: null,
    entitlements: ["exports.basic"],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createClient() {
  return {
    companySubscription: { findUnique: vi.fn() },
    companyMembership: { findFirst: vi.fn(), count: vi.fn() },
    user: { findUnique: vi.fn() },
    project: { count: vi.fn() },
    budget: { count: vi.fn() },
    aiTokenLedger: { aggregate: vi.fn() },
  };
}

describe("getWorkspaceUsage", () => {
  it("resolves plan and subscription from the company subscription", async () => {
    const client = createClient();
    client.companySubscription.findUnique.mockResolvedValue({
      provider: "STRIPE",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-08-01"),
      currentPeriodEnd: new Date("2026-08-31"),
      pastDueStartedAt: null,
      externalCustomerId: "cus_1",
      externalSubscriptionId: "sub_1",
      updatedAt: new Date("2026-08-21T10:00:00.000Z"),
      membershipPlan: makePlan(),
    });
    client.companyMembership.count.mockResolvedValue(2);
    client.project.count.mockResolvedValue(5);
    client.budget.count.mockResolvedValue(9);
    client.aiTokenLedger.aggregate.mockResolvedValue({
      _count: { _all: 4 },
      _sum: { tokens: 1200, actualCostMinor: 45, estimatedCostMinor: 50 },
    });

    const result = await getWorkspaceUsage("ws-1", client);

    expect(result.plan?.slug).toBe("pro");
    expect(result.plan?.seatLimit).toBe(10);
    expect(result.subscription?.status).toBe("ACTIVE");
    expect(result.subscription?.needsSync).toBe(false);
    expect(result.seats).toEqual({ used: 2, limit: 10 });
    expect(result.metrics.projects.count).toBe(5);
    expect(result.metrics.budgets.count).toBe(9);
    expect(result.metrics.members).toMatchObject({ count: 2, window: "actual", source: "company_memberships" });
    expect(result.aiUsage).toEqual({
      periodStart: "2026-08-01T00:00:00.000Z",
      requests: 4,
      consumedTokens: 1200,
      actualCostMinor: 45,
      estimatedCostMinor: 50,
      limit: 400000,
      availableTokens: 398800,
    });
  });

  it("falls back to the owner plan when there is no subscription", async () => {
    const client = createClient();
    client.companySubscription.findUnique.mockResolvedValue(null);
    client.companyMembership.findFirst.mockResolvedValue({ userId: "owner-1" });
    client.user.findUnique.mockResolvedValue({ membershipPlan: makePlan({ slug: "starter", name: "Starter", seatLimit: 3 }) });
    client.companyMembership.count.mockResolvedValue(1);
    client.project.count.mockResolvedValue(0);
    client.budget.count.mockResolvedValue(0);

    const result = await getWorkspaceUsage("ws-1", client);

    expect(result.subscription).toBeNull();
    expect(result.plan?.slug).toBe("starter");
    expect(result.seats.limit).toBe(3);
    expect(result.aiUsage.consumedTokens).toBe(0);
  });

  it("marks STRIPE subscriptions without external id as needing sync", async () => {
    const client = createClient();
    client.companySubscription.findUnique.mockResolvedValue({
      provider: "STRIPE",
      status: "INCOMPLETE",
      currentPeriodStart: null,
      currentPeriodEnd: null,
      pastDueStartedAt: null,
      externalCustomerId: null,
      externalSubscriptionId: null,
      updatedAt: new Date("2026-08-21T10:00:00.000Z"),
      membershipPlan: makePlan(),
    });
    client.companyMembership.count.mockResolvedValue(0);
    client.project.count.mockResolvedValue(0);
    client.budget.count.mockResolvedValue(0);

    const result = await getWorkspaceUsage("ws-1", client);

    expect(result.subscription?.needsSync).toBe(true);
    expect(result.subscription?.status).toBe("INCOMPLETE");
  });
});
