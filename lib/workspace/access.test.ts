import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    companyMembership: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  companyMembership: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe("assertWorkspaceMembership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when no membership exists", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce(null);

    await expect(
      assertWorkspaceMembership({ userId: "user-1", companyId: "ws-1" }),
    ).rejects.toThrow("Workspace no disponible");

    expect(mockPrisma.companyMembership.update).not.toHaveBeenCalled();
  });

  it("returns companyId and role for ACTIVE membership", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "ACTIVE",
      suspendedUntil: null,
    });

    const result = await assertWorkspaceMembership({
      userId: "user-1",
      companyId: "ws-1",
    });

    expect(result).toEqual({ companyId: "ws-1", role: "EDITOR" });
    expect(mockPrisma.companyMembership.update).not.toHaveBeenCalled();
  });

  it("auto-reactivates SUSPENDED member with expired suspendedUntil", async () => {
    const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "SUSPENDED",
      suspendedUntil: pastDate,
    });

    mockPrisma.companyMembership.update.mockResolvedValueOnce({} as never);

    const result = await assertWorkspaceMembership({
      userId: "user-1",
      companyId: "ws-1",
    });

    expect(result).toEqual({ companyId: "ws-1", role: "EDITOR" });
    expect(mockPrisma.companyMembership.update).toHaveBeenCalledWith({
      where: { companyId_userId: { companyId: "ws-1", userId: "user-1" } },
      data: { status: "ACTIVE", suspendedUntil: null },
    });
  });

  it("throws for SUSPENDED member with future suspendedUntil", async () => {
    const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "SUSPENDED",
      suspendedUntil: futureDate,
    });

    await expect(
      assertWorkspaceMembership({ userId: "user-1", companyId: "ws-1" }),
    ).rejects.toThrow("Workspace no disponible");

    expect(mockPrisma.companyMembership.update).not.toHaveBeenCalled();
  });

  it("throws for SUSPENDED member with null suspendedUntil (indefinite)", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "SUSPENDED",
      suspendedUntil: null,
    });

    await expect(
      assertWorkspaceMembership({ userId: "user-1", companyId: "ws-1" }),
    ).rejects.toThrow("Workspace no disponible");

    expect(mockPrisma.companyMembership.update).not.toHaveBeenCalled();
  });

  it("throws for INVITED member", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "INVITED",
      suspendedUntil: null,
    });

    await expect(
      assertWorkspaceMembership({ userId: "user-1", companyId: "ws-1" }),
    ).rejects.toThrow("Workspace no disponible");
  });

  it("throws for VIEWER when minimumRole is ADMIN", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "VIEWER",
      status: "ACTIVE",
      suspendedUntil: null,
    });

    await expect(
      assertWorkspaceMembership({
        userId: "user-1",
        companyId: "ws-1",
        minimumRole: "ADMIN",
      }),
    ).rejects.toThrow("No tienes el rol necesario");
  });

  it("passes for ADMIN when minimumRole is ADMIN", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "ADMIN",
      status: "ACTIVE",
      suspendedUntil: null,
    });

    const result = await assertWorkspaceMembership({
      userId: "user-1",
      companyId: "ws-1",
      minimumRole: "ADMIN",
    });

    expect(result).toEqual({ companyId: "ws-1", role: "ADMIN" });
  });

  it("passes for OWNER when minimumRole is EDITOR", async () => {
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "OWNER",
      status: "ACTIVE",
      suspendedUntil: null,
    });

    const result = await assertWorkspaceMembership({
      userId: "user-1",
      companyId: "ws-1",
      minimumRole: "EDITOR",
    });

    expect(result).toEqual({ companyId: "ws-1", role: "OWNER" });
  });
});
