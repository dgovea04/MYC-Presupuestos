import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    companyMembership: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/workspaces/pending/route";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  companyMembership: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

function makeSession() {
  return {
    expires: new Date().toISOString(),
    user: { id: "user-1" },
  };
}

describe("GET /api/workspaces/pending", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns empty list when user has no pending invitations", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    mockPrisma.companyMembership.findMany.mockResolvedValueOnce([]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.invitations).toEqual([]);
  });

  it("returns pending invitations with workspace and inviter info", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findMany.mockResolvedValueOnce([
      {
        companyId: "ws-1",
        role: "EDITOR",
        joinedAt: new Date("2026-07-01"),
        company: { id: "ws-1", name: "Constructora Alfa", logoUrl: null },
        invitedBy: { name: "Admin Perez" },
      },
      {
        companyId: "ws-2",
        role: "VIEWER",
        joinedAt: new Date("2026-07-05"),
        company: { id: "ws-2", name: "Constructora Beta", logoUrl: "/logo.png" },
        invitedBy: null,
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.invitations).toHaveLength(2);
    expect(body.invitations[0]).toMatchObject({
      companyId: "ws-1",
      companyName: "Constructora Alfa",
      role: "EDITOR",
      invitedByName: "Admin Perez",
    });
    expect(body.invitations[1]).toMatchObject({
      companyId: "ws-2",
      companyName: "Constructora Beta",
      role: "VIEWER",
      invitedByName: null,
    });
  });

  it("scopes pending invitations to the current user only", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findMany.mockResolvedValueOnce([]);

    await GET();

    expect(mockPrisma.companyMembership.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "INVITED" },
      include: expect.objectContaining({
        company: { select: { id: true, name: true, logoUrl: true } },
        invitedBy: { select: { name: true } },
      }),
      orderBy: { joinedAt: "asc" },
    });
  });
});
