import { describe, expect, it, vi } from "vitest";
import {
  FeatureAccessError,
  PlanLimitError,
  assertFeatureAccess,
  assertWithinPlanLimit,
  getEffectiveUserLicense,
  hasFeatureAccess,
} from "@/lib/billing/entitlements";

describe("billing entitlements", () => {
  it("keeps Starter useful but blocks Pro automation features", async () => {
    const prisma = createEntitlementPrismaMock({
      planSlug: "starter",
      projectCount: 1,
      budgetCount: 2,
      subscriptions: [],
    });

    const license = await getEffectiveUserLicense({ prisma, userId: "user-1" });

    expect(license.planSlug).toBe("starter");
    expect(hasFeatureAccess(license, "ai.local")).toBe(false);
    expect(hasFeatureAccess(license, "exports.basic")).toBe(true);
    expect(hasFeatureAccess(license, "polynomial_formula")).toBe(true);
    expect(hasFeatureAccess(license, "polynomial_formula.adjustments")).toBe(false);
    expect(hasFeatureAccess(license, "khipu.agent")).toBe(false);
    expect(hasFeatureAccess(license, "partidas.similarity")).toBe(false);
    expect(hasFeatureAccess(license, "metrados.advanced")).toBe(false);
    expect(hasFeatureAccess(license, "templates.budget")).toBe(false);
    expect(hasFeatureAccess(license, "risk_analysis")).toBe(false);
    await expect(assertFeatureAccess({ feature: "ai.local", prisma, userId: "user-1" })).rejects.toBeInstanceOf(FeatureAccessError);
  });

  it("grants Pro features for active Stripe subscriptions", async () => {
    const prisma = createEntitlementPrismaMock({
      planSlug: "starter",
      projectCount: 3,
      budgetCount: 5,
      subscriptions: [{ provider: "STRIPE", status: "ACTIVE", pastDueStartedAt: null }],
    });

    const license = await getEffectiveUserLicense({ prisma, userId: "user-1" });

    expect(license.planSlug).toBe("pro");
    expect(hasFeatureAccess(license, "ai.local")).toBe(true);
    expect(hasFeatureAccess(license, "partidas.similarity")).toBe(true);
    expect(hasFeatureAccess(license, "metrados.advanced")).toBe(true);
    expect(hasFeatureAccess(license, "templates.budget")).toBe(true);
    expect(hasFeatureAccess(license, "polynomial_formula.adjustments")).toBe(true);
    await expect(assertFeatureAccess({ feature: "risk_analysis", prisma, userId: "user-1" })).resolves.toEqual(license);
  });

  it("grants Pro features for active manual subscriptions such as Yape", async () => {
    const prisma = createEntitlementPrismaMock({
      planSlug: "pro",
      projectCount: 3,
      budgetCount: 5,
      subscriptions: [{ provider: "MANUAL", status: "ACTIVE", pastDueStartedAt: null }],
    });

    const license = await getEffectiveUserLicense({ prisma, userId: "user-1" });

    expect(license.planSlug).toBe("pro");
    expect(hasFeatureAccess(license, "ai.local")).toBe(true);
    expect(hasFeatureAccess(license, "exports.advanced")).toBe(true);
  });

  it("keeps Pro during the first three days of past_due and then falls back to Starter", async () => {
    const startedAt = new Date("2026-05-01T00:00:00.000Z");
    const prisma = createEntitlementPrismaMock({
      planSlug: "pro",
      projectCount: 3,
      budgetCount: 5,
      subscriptions: [{ provider: "STRIPE", status: "PAST_DUE", pastDueStartedAt: startedAt }],
    });

    await expect(
      getEffectiveUserLicense({ now: new Date("2026-05-03T23:59:59.000Z"), prisma, userId: "user-1" }),
    ).resolves.toMatchObject({ planSlug: "pro", isInGracePeriod: true });

    await expect(
      getEffectiveUserLicense({ now: new Date("2026-05-05T00:00:01.000Z"), prisma, userId: "user-1" }),
    ).resolves.toMatchObject({ planSlug: "starter", isInGracePeriod: false });
  });

  it("enforces Starter project and budget limits", async () => {
    const prisma = createEntitlementPrismaMock({
      planSlug: "starter",
      projectCount: 3,
      budgetCount: 4,
      subscriptions: [],
    });

    await expect(assertWithinPlanLimit({ prisma, resource: "projects", userId: "user-1" })).rejects.toBeInstanceOf(PlanLimitError);
    await expect(assertWithinPlanLimit({ prisma, resource: "budgets", userId: "user-1" })).resolves.toBeUndefined();
  });
});

function createEntitlementPrismaMock({
  budgetCount,
  planSlug,
  projectCount,
  subscriptions,
}: {
  budgetCount: number;
  planSlug: "starter" | "pro" | "empresa";
  projectCount: number;
  subscriptions: Array<{ provider: "STRIPE" | "MANUAL"; status: "ACTIVE" | "PAST_DUE"; pastDueStartedAt: Date | null }>;
}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: "user-1",
        membershipPlan: {
          name: planSlug === "empresa" ? "Empresa" : planSlug === "pro" ? "Pro" : "Starter",
          slug: planSlug,
          projectLimit: planSlug === "starter" ? 3 : null,
          budgetLimit: planSlug === "starter" ? 5 : null,
          entitlements: [],
        },
        billingSubscriptions: subscriptions,
        companies: [{ _count: { projects: projectCount } }],
      }),
    },
    budget: {
      count: vi.fn().mockResolvedValue(budgetCount),
    },
  };
}
