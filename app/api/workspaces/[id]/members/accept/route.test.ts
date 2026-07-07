import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    companyMembership: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/workspaces/[id]/members/accept/route";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  companyMembership: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function makeSession() {
  return {
    expires: new Date().toISOString(),
    user: { id: "user-1" },
  };
}

describe("POST /api/workspaces/[id]/members/accept", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members/accept", { method: "POST" }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when user has no invitation to the workspace", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce(null);

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members/accept", { method: "POST" }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("invitación");
  });

  it("returns 409 when membership is already ACTIVE", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({ status: "ACTIVE" });

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members/accept", { method: "POST" }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("miembro activo");
  });

  it("returns 409 when membership is SUSPENDED", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({ status: "SUSPENDED" });

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members/accept", { method: "POST" }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(409);
  });

  it("accepts invitation and returns workspace info", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({ status: "INVITED" });

    mockPrisma.companyMembership.update.mockResolvedValueOnce({
      companyId: "ws-1",
      role: "EDITOR",
      company: { id: "ws-1", name: "Constructora Andina", logoUrl: null },
      invitedBy: { name: "Admin" },
    });

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members/accept", { method: "POST" }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workspace).toEqual({
      id: "ws-1",
      name: "Constructora Andina",
      role: "EDITOR",
      logoUrl: null,
    });

    expect(mockPrisma.companyMembership.update).toHaveBeenCalledWith({
      where: { companyId_userId: { companyId: "ws-1", userId: "user-1" } },
      data: { status: "ACTIVE", joinedAt: expect.any(Date) as Date },
      include: expect.objectContaining({
        company: { select: { id: true, name: true, logoUrl: true } },
      }),
    });
  });
});
