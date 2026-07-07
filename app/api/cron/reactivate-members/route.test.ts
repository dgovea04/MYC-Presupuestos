import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    companyMembership: {
      updateMany: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/cron/reactivate-members/route";
import { prisma } from "@/lib/db/prisma";

const mockPrisma = prisma as unknown as {
  companyMembership: {
    updateMany: ReturnType<typeof vi.fn>;
  };
};

const originalEnv = process.env;

describe("GET /api/cron/reactivate-members", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(
      new Request("http://localhost/api/cron/reactivate-members", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(500);
  });

  it("returns 401 when no Authorization header", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/reactivate-members"),
    );

    expect(response.status).toBe(401);
  });

  it("returns 401 when wrong secret", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/reactivate-members", {
        headers: { Authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns 401 when Authorization header is malformed", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/reactivate-members", {
        headers: { Authorization: "Basic test-secret" },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("accepts secret via query parameter (Vercel Cron)", async () => {
    mockPrisma.companyMembership.updateMany.mockResolvedValueOnce({ count: 1 });

    const response = await GET(
      new Request("http://localhost/api/cron/reactivate-members?secret=test-secret"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reactivated).toBe(1);
  });

  it("returns 401 when query parameter secret is wrong", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/reactivate-members?secret=wrong"),
    );

    expect(response.status).toBe(401);
  });

  it("reactivates expired members and returns count", async () => {
    mockPrisma.companyMembership.updateMany.mockResolvedValueOnce({ count: 3 });

    const response = await GET(
      new Request("http://localhost/api/cron/reactivate-members", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reactivated).toBe(3);
    expect(body.checkedAt).toBeTruthy();

    expect(mockPrisma.companyMembership.updateMany).toHaveBeenCalledWith({
      where: {
        status: "SUSPENDED",
        suspendedUntil: { not: null, lte: expect.any(Date) },
      },
      data: {
        status: "ACTIVE",
        suspendedUntil: null,
      },
    });
  });

  it("returns zero when no expired suspensions", async () => {
    mockPrisma.companyMembership.updateMany.mockResolvedValueOnce({ count: 0 });

    const response = await GET(
      new Request("http://localhost/api/cron/reactivate-members", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reactivated).toBe(0);
  });
});
