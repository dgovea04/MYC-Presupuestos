import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/workspace/entitlements", () => ({
  assertWorkspaceFeatureAccess: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    companyMembership: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/workspaces/[id]/members/reject/route";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  companyMembership: {
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

function makeSession() {
  return {
    expires: new Date().toISOString(),
    user: { id: "user-1" },
  };
}

describe("POST /api/workspaces/[id]/members/reject", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when user has no invitation", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce(null);

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns 409 when membership is ACTIVE", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({ status: "ACTIVE" });

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(409);
  });

  it("returns 409 when membership is SUSPENDED", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({ status: "SUSPENDED" });

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(409);
  });

  it("deletes INVITED membership and returns ok", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({ status: "INVITED" });
    mockPrisma.companyMembership.delete.mockResolvedValueOnce({} as never);

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);

    expect(mockPrisma.companyMembership.delete).toHaveBeenCalledWith({
      where: { companyId_userId: { companyId: "ws-1", userId: "user-1" } },
    });
  });
});
