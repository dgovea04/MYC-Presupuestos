import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    companyMembership: {
      findUnique: vi.fn(),
    },
    companySubscription: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  getActiveWorkspaceId: vi.fn(),
}));

import { getWorkspaceContextForUser } from "@/lib/workspace/context";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  companyMembership: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  companySubscription: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

describe("getWorkspaceContextForUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when user has no active workspace", async () => {
    vi.mocked(getActiveWorkspaceId).mockResolvedValue(null);

    const result = await getWorkspaceContextForUser("user-1");

    expect(result).toBeNull();
    expect(mockPrisma.companyMembership.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when membership does not exist", async () => {
    vi.mocked(getActiveWorkspaceId).mockResolvedValue("company-1");
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce(null);

    const result = await getWorkspaceContextForUser("user-1");

    expect(result).toBeNull();
  });

  it("returns workspace context with plan slug for active membership", async () => {
    vi.mocked(getActiveWorkspaceId).mockResolvedValue("company-1");
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "OWNER",
      company: { name: "MYC Ingenieria", logoUrl: null },
    });
    mockPrisma.companySubscription.findUnique.mockResolvedValueOnce({
      membershipPlan: { slug: "empresa", name: "Empresa" },
    });

    const result = await getWorkspaceContextForUser("user-1");

    expect(result).toEqual({
      workspace: {
        id: "company-1",
        name: "MYC Ingenieria",
        role: "OWNER",
        logoUrl: null,
      },
      featureFlags: [],
      planSlug: "empresa",
    });
  });

  it("returns workspace context with starter plan when no subscription exists", async () => {
    vi.mocked(getActiveWorkspaceId).mockResolvedValue("company-1");
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "ADMIN",
      company: { name: "Constructora Demo", logoUrl: null },
    });
    mockPrisma.companySubscription.findUnique.mockResolvedValueOnce(null);

    const result = await getWorkspaceContextForUser("user-1");

    expect(result).toEqual({
      workspace: {
        id: "company-1",
        name: "Constructora Demo",
        role: "ADMIN",
        logoUrl: null,
      },
      featureFlags: [],
      planSlug: "starter",
    });
  });

  it("returns workspace context with logoUrl when present", async () => {
    vi.mocked(getActiveWorkspaceId).mockResolvedValue("company-1");
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      company: { name: "Empresa con Logo", logoUrl: "/logos/company-1.png" },
    });
    mockPrisma.companySubscription.findUnique.mockResolvedValueOnce({
      membershipPlan: { slug: "pro", name: "Pro" },
    });

    const result = await getWorkspaceContextForUser("user-1");

    expect(result).toEqual({
      workspace: {
        id: "company-1",
        name: "Empresa con Logo",
        role: "EDITOR",
        logoUrl: "/logos/company-1.png",
      },
      featureFlags: [],
      planSlug: "pro",
    });
  });

  it("calls getActiveWorkspaceId with the correct userId", async () => {
    vi.mocked(getActiveWorkspaceId).mockResolvedValue(null);

    await getWorkspaceContextForUser("user-specific");

    expect(getActiveWorkspaceId).toHaveBeenCalledWith("user-specific");
  });

  it("calls findUnique with correct companyId_userId composite key", async () => {
    vi.mocked(getActiveWorkspaceId).mockResolvedValue("company-42");
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "VIEWER",
      company: { name: "Test Co", logoUrl: null },
    });
    mockPrisma.companySubscription.findUnique.mockResolvedValueOnce(null);

    await getWorkspaceContextForUser("user-99");

    expect(mockPrisma.companyMembership.findUnique).toHaveBeenCalledWith({
      where: { companyId_userId: { companyId: "company-42", userId: "user-99" } },
      select: {
        role: true,
        company: { select: { name: true, logoUrl: true } },
      },
    });
  });
});
