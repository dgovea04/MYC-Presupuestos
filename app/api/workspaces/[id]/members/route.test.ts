import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    companyMembership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET, POST } from "@/app/api/workspaces/[id]/members/route";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  companyMembership: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    expires: new Date().toISOString(),
    user: { id: "user-1", ...overrides },
  };
}

describe("GET /api/workspaces/[id]/members", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/workspaces/ws-1/members"),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when user has no membership at all", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce(null);

    const response = await GET(
      new Request("http://localhost/api/workspaces/ws-1/members"),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 when user is a VIEWER (insufficient role)", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "VIEWER",
      status: "ACTIVE",
    });

    const response = await GET(
      new Request("http://localhost/api/workspaces/ws-1/members"),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 when user is an EDITOR (insufficient role)", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "ACTIVE",
    });

    const response = await GET(
      new Request("http://localhost/api/workspaces/ws-1/members"),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 when membership status is not ACTIVE", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "OWNER",
      status: "INVITED",
    });

    const response = await GET(
      new Request("http://localhost/api/workspaces/ws-1/members"),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("returns members list when user is ADMIN", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "ADMIN",
      status: "ACTIVE",
    });

    mockPrisma.companyMembership.findMany.mockResolvedValueOnce([
      {
        id: "mem-1",
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        user: { id: "user-1", name: "Owner", email: "owner@test.com", avatarUrl: null },
        invitedBy: null,
        joinedAt: new Date("2026-01-01"),
      },
      {
        id: "mem-2",
        userId: "user-2",
        role: "EDITOR",
        status: "INVITED",
        user: { id: "user-2", name: "Invitado", email: "invitado@test.com", avatarUrl: null },
        invitedBy: { id: "user-1", name: "Owner" },
        joinedAt: new Date("2026-06-01"),
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/workspaces/ws-1/members"),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.members).toHaveLength(2);
    expect(body.members[0].role).toBe("OWNER");
    expect(body.members[0].status).toBe("ACTIVE");
    expect(body.members[0].invitedByName).toBeNull();
    expect(body.members[1].status).toBe("INVITED");
    expect(body.members[1].invitedByName).toBe("Owner");
  });

  it("returns members list when user is OWNER", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "OWNER",
      status: "ACTIVE",
    });

    mockPrisma.companyMembership.findMany.mockResolvedValueOnce([]);

    const response = await GET(
      new Request("http://localhost/api/workspaces/ws-1/members"),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.members).toEqual([]);
  });
});

describe("POST /api/workspaces/[id]/members", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invitee@test.com" }),
      }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when user lacks ADMIN role", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "EDITOR",
      status: "ACTIVE",
    });

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invitee@test.com" }),
      }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("returns 400 when email is missing", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "ADMIN",
      status: "ACTIVE",
    });

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when email is invalid", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce({
      role: "ADMIN",
      status: "ACTIVE",
    });

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when invitee user is not found", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique
      .mockResolvedValueOnce({ role: "ADMIN", status: "ACTIVE" }) // assert
      .mockResolvedValueOnce(null); // self-invite check won't be reached since user not found

    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "unknown@test.com" }),
      }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("email");
  });

  it("normalizes email to lowercase before lookup", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique
      .mockResolvedValueOnce({ role: "ADMIN", status: "ACTIVE" }) // assert
      .mockResolvedValueOnce(null); // self-invite won't match (different user ids)

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      name: "Other User",
      email: "invitee@test.com",
    });

    // Second findUnique for existing membership check
    mockPrisma.companyMembership.findUnique.mockResolvedValueOnce(null);

    mockPrisma.companyMembership.create.mockResolvedValueOnce({
      id: "mem-new",
      userId: "user-2",
      role: "EDITOR",
      status: "INVITED",
      invitedById: "user-1",
      joinedAt: new Date("2026-07-07"),
      user: { id: "user-2", name: "Other User", email: "invitee@test.com", avatarUrl: null },
      invitedBy: { id: "user-1", name: "Admin" },
    });

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: " Invitee@Test.com " }),
      }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    // Verify invitation was created (email was normalized and user was found)
    expect(response.status).toBe(201);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "invitee@test.com" },
      select: { id: true, name: true, email: true },
    });
  });

  it("returns 400 when inviting yourself (checked before existing membership)", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique
      .mockResolvedValueOnce({ role: "OWNER", status: "ACTIVE" }); // assert

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      name: "Self",
      email: "self@test.com",
    });

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "self@test.com" }),
      }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("invitarte a ti mismo");
    // Should NOT have checked existing membership
    expect(mockPrisma.companyMembership.findUnique).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when user is already an active member", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique
      .mockResolvedValueOnce({ role: "ADMIN", status: "ACTIVE" }) // assert
      .mockResolvedValueOnce({ role: "EDITOR", status: "ACTIVE" }); // existing membership

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      name: "Existing Member",
      email: "existing@test.com",
    });

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "existing@test.com" }),
      }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("miembro activo");
    expect(body.existingStatus).toBe("ACTIVE");
  });

  it("returns 409 when user already has a pending invitation", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique
      .mockResolvedValueOnce({ role: "ADMIN", status: "ACTIVE" }) // assert
      .mockResolvedValueOnce({ role: "EDITOR", status: "INVITED" }); // existing membership

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      name: "Pending User",
      email: "pending@test.com",
    });

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "pending@test.com" }),
      }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("invitación pendiente");
    expect(body.existingStatus).toBe("INVITED");
  });

  it("creates invitation with EDITOR role and INVITED status", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    mockPrisma.companyMembership.findUnique
      .mockResolvedValueOnce({ role: "ADMIN", status: "ACTIVE" }) // assert
      .mockResolvedValueOnce(null); // existing membership check (after self-invite)

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      name: "New User",
      email: "new@test.com",
    });

    const createdMembership = {
      id: "mem-new",
      companyId: "ws-1",
      userId: "user-2",
      role: "EDITOR",
      status: "INVITED",
      invitedById: "user-1",
      joinedAt: new Date("2026-07-07"),
      user: { id: "user-2", name: "New User", email: "new@test.com", avatarUrl: null },
      invitedBy: { id: "user-1", name: "Admin" },
    };

    mockPrisma.companyMembership.create.mockResolvedValueOnce(createdMembership);

    const response = await POST(
      new Request("http://localhost/api/workspaces/ws-1/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@test.com" }),
      }),
      { params: Promise.resolve({ id: "ws-1" }) },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.member.userId).toBe("user-2");
    expect(body.member.role).toBe("EDITOR");
    expect(body.member.status).toBe("INVITED");
    expect(body.member.invitedByName).toBe("Admin");

    // Verify creation params
    expect(mockPrisma.companyMembership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "ws-1",
        userId: "user-2",
        role: "EDITOR",
        status: "INVITED",
        invitedById: "user-1",
      }),
      include: expect.objectContaining({
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        invitedBy: { select: { id: true, name: true } },
      }),
    });
  });
});
