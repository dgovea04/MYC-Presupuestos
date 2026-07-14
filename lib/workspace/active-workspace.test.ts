import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  companyMembership: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
}));

const mockCookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

import { getActiveWorkspaceId, listUserWorkspaces, setActiveWorkspaceId } from "@/lib/workspace/active-workspace";

describe("getActiveWorkspaceId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the stored workspace id when membership is ACTIVE", async () => {
    mockCookieStore.get.mockReturnValue({ value: "company-42" });
    mockPrisma.companyMembership.findUnique.mockResolvedValue({ status: "ACTIVE" });

    const result = await getActiveWorkspaceId("user-1");

    expect(result).toBe("company-42");
    expect(mockPrisma.companyMembership.findUnique).toHaveBeenCalledWith({
      where: { companyId_userId: { companyId: "company-42", userId: "user-1" } },
      select: { status: true },
    });
  });

  it("returns null when stored workspace membership does not exist", async () => {
    mockCookieStore.get.mockReturnValue({ value: "company-42" });
    mockPrisma.companyMembership.findUnique.mockResolvedValue(null);

    const result = await getActiveWorkspaceId("user-1");

    expect(result).toBeNull();
  });

  it("returns null when stored workspace membership is not ACTIVE", async () => {
    mockCookieStore.get.mockReturnValue({ value: "company-42" });
    mockPrisma.companyMembership.findUnique.mockResolvedValue({ status: "SUSPENDED" });

    const result = await getActiveWorkspaceId("user-1");

    expect(result).toBeNull();
  });

  it("falls back to the first active membership when no cookie is stored", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    mockPrisma.companyMembership.findFirst.mockResolvedValue({ companyId: "company-99" });

    const result = await getActiveWorkspaceId("user-1");

    expect(result).toBe("company-99");
    expect(mockPrisma.companyMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "ACTIVE" },
      orderBy: { joinedAt: "asc" },
      select: { companyId: true },
    });
  });

  it("returns null when no active membership exists at all", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    mockPrisma.companyMembership.findFirst.mockResolvedValue(null);

    const result = await getActiveWorkspaceId("user-1");

    expect(result).toBeNull();
  });

  it("falls back to first active membership when stored workspace membership is invalid", async () => {
    mockCookieStore.get.mockReturnValue({ value: "company-invalid" });
    mockPrisma.companyMembership.findUnique.mockResolvedValue(null);
    mockPrisma.companyMembership.findFirst.mockResolvedValue({ companyId: "company-fallback" });

    const result = await getActiveWorkspaceId("user-1");

    expect(result).toBe("company-fallback");
  });
});

describe("setActiveWorkspaceId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when membership does not exist", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValue(null);

    await expect(
      setActiveWorkspaceId("user-1", "company-42"),
    ).rejects.toThrow("No perteneces a este workspace");

    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it("throws when membership status is not ACTIVE", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValue({ status: "INVITED" });

    await expect(
      setActiveWorkspaceId("user-1", "company-42"),
    ).rejects.toThrow("No perteneces a este workspace");

    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it("sets the cookie when membership is ACTIVE", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValue({ status: "ACTIVE" });

    await setActiveWorkspaceId("user-1", "company-42");

    expect(mockCookieStore.set).toHaveBeenCalledWith("myc_active_workspace", "company-42", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });
  });

  it("sets secure flag in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    mockPrisma.companyMembership.findUnique.mockResolvedValue({ status: "ACTIVE" });

    await setActiveWorkspaceId("user-1", "company-42");

    expect(mockCookieStore.set).toHaveBeenCalledWith("myc_active_workspace", "company-42", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });

    vi.unstubAllEnvs();
  });
});

describe("listUserWorkspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when user has no active memberships", async () => {
    mockPrisma.companyMembership.findMany.mockResolvedValue([]);

    const result = await listUserWorkspaces("user-1");

    expect(result).toEqual([]);
    expect(mockPrisma.companyMembership.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "ACTIVE" },
      include: { company: { select: { name: true, logoUrl: true } } },
      orderBy: { joinedAt: "asc" },
    });
  });

  it("returns formatted workspace list with all fields", async () => {
    mockPrisma.companyMembership.findMany.mockResolvedValue([
      {
        companyId: "company-1",
        role: "OWNER",
        company: { name: "MYC Ingenieria", logoUrl: "/logos/myc.png" },
      },
      {
        companyId: "company-2",
        role: "EDITOR",
        company: { name: "Constructora Demo", logoUrl: null },
      },
    ]);

    const result = await listUserWorkspaces("user-1");

    expect(result).toEqual([
      { id: "company-1", name: "MYC Ingenieria", role: "OWNER", logoUrl: "/logos/myc.png" },
      { id: "company-2", name: "Constructora Demo", role: "EDITOR", logoUrl: null },
    ]);
  });

  it("only returns ACTIVE memberships", async () => {
    mockPrisma.companyMembership.findMany.mockResolvedValue([]);

    await listUserWorkspaces("user-1");

    expect(mockPrisma.companyMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });
});
