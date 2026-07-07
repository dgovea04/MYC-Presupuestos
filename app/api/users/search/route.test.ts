import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    company: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/users/search/route";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  company: { findMany: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
};

describe("users search route", () => {
  it("requires authentication", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/users/search?q=ca"));

    expect(response.status).toBe(401);
  });

  it("returns empty when query is less than 2 characters", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    const response = await GET(new Request("http://localhost/api/users/search?q=a"));

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ users: [] });
  });

  it("returns empty when query is empty", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    const response = await GET(new Request("http://localhost/api/users/search?q="));

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ users: [] });
  });

  it("returns empty when user has no companies", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    mockPrisma.company.findMany.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/users/search?q=ca"));

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ users: [] });
  });

  it("scopes results to users sharing a company name", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    mockPrisma.company.findMany.mockResolvedValue([
      { name: "Mi Empresa S.A.C." },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user-2", name: "Carlos", email: "carlos@miempresa.com", avatarUrl: null },
    ]);

    const response = await GET(new Request("http://localhost/api/users/search?q=car"));

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.users).toHaveLength(1);
    expect(body.users[0].name).toBe("Carlos");

    // Verify company filter was applied
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companies: {
            some: {
              name: { in: ["Mi Empresa S.A.C."] },
            },
          },
        }),
      }),
    );
  });

  it("excludes the current user from results", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    mockPrisma.company.findMany.mockResolvedValue([
      { name: "Mi Empresa S.A.C." },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/users/search?q=user"));

    const body = await response.json();
    expect(response.status).toBe(200);

    // Verify self-exclusion filter was applied
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "user-1" },
        }),
      }),
    );
  });

  it("searches by name with case-insensitive matching", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    mockPrisma.company.findMany.mockResolvedValue([
      { name: "Mi Empresa S.A.C." },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user-2", name: "Carlos Perez", email: "carlos@test.com", avatarUrl: null },
    ]);

    const response = await GET(new Request("http://localhost/api/users/search?q=carlo"));

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.users).toHaveLength(1);
    expect(body.users[0].name).toBe("Carlos Perez");
  });

  it("searches by email with case-insensitive matching", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    mockPrisma.company.findMany.mockResolvedValue([
      { name: "Mi Empresa S.A.C." },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user-2", name: "Carlos", email: "carlos@miempresa.com", avatarUrl: null },
    ]);

    const response = await GET(new Request("http://localhost/api/users/search?q=MIEMPRESA"));

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.users).toHaveLength(1);
    expect(body.users[0].email).toBe("carlos@miempresa.com");
  });

  it("returns empty when no users match the query", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    mockPrisma.company.findMany.mockResolvedValue([
      { name: "Mi Empresa S.A.C." },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/users/search?q=zzz"));

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ users: [] });
  });

  it("limits results to 8 users", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    mockPrisma.company.findMany.mockResolvedValue([
      { name: "Mi Empresa S.A.C." },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/users/search?q=test"));

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 8,
      }),
    );
  });

  it("returns empty array when database throws", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    mockPrisma.company.findMany.mockRejectedValue(new Error("DB error"));

    const response = await GET(new Request("http://localhost/api/users/search?q=ca"));

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ users: [] });
  });

  it("deduplicates company names from the current user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    mockPrisma.company.findMany.mockResolvedValue([
      { name: "Mi Empresa S.A.C." },
      { name: "Mi Empresa S.A.C." },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/users/search?q=ca"));

    // Should dedupe to a single company name
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companies: {
            some: {
              name: { in: ["Mi Empresa S.A.C."] },
            },
          },
        }),
      }),
    );
  });

  it("searches across multiple company names the user belongs to", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    mockPrisma.company.findMany.mockResolvedValue([
      { name: "Constructora Alfa" },
      { name: "Constructora Beta" },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/users/search?q=ca"));

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companies: {
            some: {
              name: { in: ["Constructora Alfa", "Constructora Beta"] },
            },
          },
        }),
      }),
    );
  });
});
