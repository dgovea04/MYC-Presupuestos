import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    companyMembership: {
      findUnique: vi.fn(),
    },
    companySubscription: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    membershipPlan: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/beta/access", () => ({
  getActiveBetaAccess: vi.fn().mockResolvedValue(null),
  isBetaAccessActive: vi.fn().mockReturnValue(true),
}));

import { getEffectiveWorkspaceLicense, assertWorkspaceFeatureAccess } from "@/lib/workspace/entitlements";
import { getActiveBetaAccess, isBetaAccessActive } from "@/lib/beta/access";
import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  companyMembership: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  companySubscription: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  membershipPlan: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

describe("getEffectiveWorkspaceLicense", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getActiveBetaAccess).mockResolvedValue(null);
    vi.mocked(isBetaAccessActive).mockReturnValue(true);
  });

  it("returns null when membership does not exist", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce(null);

    const result = await getEffectiveWorkspaceLicense({
      userId: "user-1",
      companyId: "company-1",
    });

    expect(result).toBeNull();
  });

  it("returns null when membership status is not ACTIVE", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "INVITED",
    });

    const result = await getEffectiveWorkspaceLicense({
      userId: "user-1",
      companyId: "company-1",
    });

    expect(result).toBeNull();
  });

  it("returns null when membership is SUSPENDED", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "SUSPENDED",
    });

    const result = await getEffectiveWorkspaceLicense({
      userId: "user-1",
      companyId: "company-1",
    });

    expect(result).toBeNull();
  });

  it("returns license with starter features when no subscription and no user plan exist", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "ACTIVE",
    });
    mockPrisma.companySubscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await getEffectiveWorkspaceLicense({
      userId: "user-1",
      companyId: "company-1",
    });

    expect(result).not.toBeNull();
    expect(result!.planSlug).toBe("starter");
    expect(result!.planName).toBe("Starter");
    expect(result!.role).toBe("EDITOR");
    // Starter features
    expect(result!.availableFeatures).toContain("exports.basic");
    expect(result!.availableFeatures).toContain("polynomial_formula");
    // Pro features should NOT be available
    expect(result!.availableFeatures).not.toContain("risk_analysis");
    expect(result!.availableFeatures).not.toContain("ai.local");
    expect(result!.availableFeatures).not.toContain("exports.advanced");
  });

  it("falls back to user personal plan when no company subscription exists", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "ACTIVE",
    });
    mockPrisma.companySubscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      membershipPlan: { slug: "empresa", name: "Empresa" },
    });

    const result = await getEffectiveWorkspaceLicense({
      userId: "user-1",
      companyId: "company-1",
    });

    expect(result).not.toBeNull();
    expect(result!.planSlug).toBe("empresa");
    expect(result!.planName).toBe("Empresa");
    expect(result!.role).toBe("EDITOR");
    // Empresa features should be available from user's personal plan
    expect(result!.availableFeatures).toContain("ai.local");
    expect(result!.availableFeatures).toContain("risk_analysis");
    expect(result!.availableFeatures).toContain("desktop.native_bridge");
  });

  it("returns license with pro features for pro plan", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "ADMIN",
      status: "ACTIVE",
    });
    mockPrisma.companySubscription.findUnique.mockResolvedValueOnce({
      membershipPlan: { slug: "pro", name: "Pro" },
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await getEffectiveWorkspaceLicense({
      userId: "user-1",
      companyId: "company-1",
    });

    expect(result).not.toBeNull();
    expect(result!.planSlug).toBe("pro");
    expect(result!.planName).toBe("Pro");
    expect(result!.role).toBe("ADMIN");
    // Pro features
    expect(result!.availableFeatures).toContain("exports.basic");
    expect(result!.availableFeatures).toContain("polynomial_formula");
    expect(result!.availableFeatures).toContain("risk_analysis");
    expect(result!.availableFeatures).toContain("ai.local");
    expect(result!.availableFeatures).toContain("exports.advanced");
    expect(result!.availableFeatures).toContain("partidas.similarity");
    expect(result!.availableFeatures).toContain("work_schedule.intelligent");
    expect(result!.availableFeatures).toContain("polynomial_formula.adjustments");
    // Empresa-only features should NOT be available
    expect(result!.availableFeatures).not.toContain("desktop.native_bridge");
  });

  it("returns license with empresa features for empresa plan", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "OWNER",
      status: "ACTIVE",
    });
    mockPrisma.companySubscription.findUnique.mockResolvedValueOnce({
      membershipPlan: { slug: "empresa", name: "Empresa" },
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await getEffectiveWorkspaceLicense({
      userId: "user-1",
      companyId: "company-1",
    });

    expect(result).not.toBeNull();
    expect(result!.planSlug).toBe("empresa");
    expect(result!.planName).toBe("Empresa");
    expect(result!.role).toBe("OWNER");
    // All features including empresa-only
    expect(result!.availableFeatures).toContain("desktop.native_bridge");
    expect(result!.availableFeatures).toContain("risk_analysis");
    expect(result!.availableFeatures).toContain("ai.local");
  });

  it("calls findUnique with correct composite key", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "VIEWER",
      status: "ACTIVE",
    });
    mockPrisma.companySubscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    await getEffectiveWorkspaceLicense({
      userId: "user-test",
      companyId: "company-test",
    });

    expect(mockPrisma.companyMembership.findUnique).toHaveBeenCalledWith({
      where: {
        companyId_userId: {
          companyId: "company-test",
          userId: "user-test",
        },
      },
      select: { role: true, status: true },
    });
  });
});

describe("assertWorkspaceFeatureAccess", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getActiveBetaAccess).mockResolvedValue(null);
    vi.mocked(isBetaAccessActive).mockReturnValue(true);
  });

  it("throws when user has no license", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce(null);

    await expect(
      assertWorkspaceFeatureAccess({
        userId: "user-1",
        companyId: "company-1",
        feature: "exports.basic",
      }),
    ).rejects.toThrow("No tienes acceso a este workspace");
  });

  it("throws when feature is not available in the plan", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "ACTIVE",
    });
    mockPrisma.companySubscription.findUnique.mockResolvedValueOnce(null); // no company subscription
    mockPrisma.user.findUnique.mockResolvedValueOnce(null); // no user plan → starter

    await expect(
      assertWorkspaceFeatureAccess({
        userId: "user-1",
        companyId: "company-1",
        feature: "risk_analysis",
      }),
    ).rejects.toThrow('La funcionalidad "risk_analysis" no esta disponible en tu plan');
  });

  it("passes when feature is available in the plan", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "ACTIVE",
    });
    mockPrisma.companySubscription.findUnique.mockResolvedValueOnce({
      membershipPlan: { slug: "pro", name: "Pro" },
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      assertWorkspaceFeatureAccess({
        userId: "user-1",
        companyId: "company-1",
        feature: "risk_analysis",
      }),
    ).resolves.toBeUndefined();
  });

  it("passes for basic features on starter plan", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "ACTIVE",
    });
    mockPrisma.companySubscription.findUnique.mockResolvedValueOnce(null); // no company subscription
    mockPrisma.user.findUnique.mockResolvedValueOnce(null); // no user plan → starter

    await expect(
      assertWorkspaceFeatureAccess({
        userId: "user-1",
        companyId: "company-1",
        feature: "exports.basic",
      }),
    ).resolves.toBeUndefined();
  });
});
