import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    membershipPlan: {
      findMany: vi.fn(),
    },
    aiUsagePeriod: {
      aggregate: vi.fn(),
    },
    aiTokenLedger: {
      groupBy: vi.fn(),
    },
    billingSubscription: {
      findMany: vi.fn(),
    },
    companySubscription: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ai/usage", () => ({
  getCurrentAiUsagePeriod: () => new Date("2026-08-01T00:00:00.000Z"),
}));

import {
  getAdminDashboardStats,
  normalizeAdminUserPage,
  normalizeAdminUserQuery,
} from "@/lib/data/admin-dashboard";

describe("admin dashboard user filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-51",
        name: "Test User",
        email: "test@example.com",
        emailVerifiedAt: null,
        role: "USER",
        status: "ACTIVE",
        aiTokenExtraMonthly: 0,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        companies: [],
        membershipPlan: {
          name: "Starter",
          slug: "starter",
          billingMode: "FREE",
          monthlyTokenLimit: 1000,
        },
        billingSubscriptions: [],
        aiUsagePeriods: [],
      },
    ]);
    prismaMock.user.count
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prismaMock.membershipPlan.findMany.mockResolvedValue([
      {
        id: "plan-starter",
        name: "Starter",
        slug: "starter",
        billingMode: "FREE",
        projectLimit: 1,
        budgetLimit: 1,
        monthlyTokenLimit: 1000,
        _count: { users: 60 },
      },
    ]);
    prismaMock.aiUsagePeriod.aggregate.mockResolvedValue({ _sum: { consumedTokens: null, reservedTokens: null } });
    prismaMock.aiTokenLedger.groupBy.mockResolvedValue([]);
    prismaMock.billingSubscription.findMany.mockResolvedValue([]);
    prismaMock.companySubscription.findMany.mockResolvedValue([]);
  });

  it("normalizes whitespace and limits the search query", () => {
    expect(normalizeAdminUserQuery("  test2   @test2.com  ")).toBe("test2   @test2.com");
    expect(normalizeAdminUserQuery(" ")).toBeUndefined();
    expect(normalizeAdminUserQuery("x".repeat(150))).toHaveLength(100);
  });

  it("falls back to the first page for invalid pagination values", () => {
    expect(normalizeAdminUserPage()).toBe(1);
    expect(normalizeAdminUserPage(0)).toBe(1);
    expect(normalizeAdminUserPage(-2)).toBe(1);
    expect(normalizeAdminUserPage(1.5)).toBe(1);
    expect(normalizeAdminUserPage(3)).toBe(3);
  });

  it("applies the search query and page window in the database query", async () => {
    const result = await getAdminDashboardStats({ query: " test@example.com ", status: "ACTIVE", page: 3 });

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: undefined,
          status: "ACTIVE",
          membershipPlan: undefined,
          OR: [
            { name: { contains: "test@example.com", mode: "insensitive" } },
            { email: { contains: "test@example.com", mode: "insensitive" } },
          ],
        },
        skip: 50,
        take: 25,
      }),
    );
    expect(result.pagination).toEqual({
      page: 3,
      pageSize: 25,
      totalUsers: 60,
      totalPages: 3,
      query: "test@example.com",
    });
  });
});
