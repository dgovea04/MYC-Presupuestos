import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  consumeRateLimit: vi.fn(),
  getRequestClientIp: vi.fn(),
  listBetaGrants: vi.fn(),
  recordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/auth/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  getRateLimitHeaders: vi.fn(() => ({ "Retry-After": "60" })),
  getRequestClientIp: mocks.getRequestClientIp,
}));
vi.mock("@/lib/beta/campaigns", () => ({
  BETA_GRANTS_EXPORT_PAGE_SIZE: 5000,
  listBetaGrants: mocks.listBetaGrants,
}));
vi.mock("@/lib/data/admin-audit", () => ({ recordAdminAudit: mocks.recordAdminAudit }));

import { GET } from "@/app/api/admin/beta/grants/export/route";

describe("admin beta grants export route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getRequestClientIp.mockReturnValue("127.0.0.1");
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true });
    mocks.recordAdminAudit.mockResolvedValue(undefined);
  });

  it("requires beta export permission", async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/beta/grants/export?campaignId=campaign-1"));

    expect(response.status).toBe(403);
    expect(mocks.listBetaGrants).not.toHaveBeenCalled();
  });

  it("requires a campaign filter", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });

    const response = await GET(new Request("http://localhost/api/admin/beta/grants/export"));

    expect(response.status).toBe(400);
    expect(mocks.listBetaGrants).not.toHaveBeenCalled();
  });

  it("exports filtered grants as escaped UTF-8 CSV and audits the operation", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } });
    mocks.listBetaGrants.mockResolvedValue({
      grants: [
        {
          id: "grant-1",
          userId: "user-1",
          companyId: null,
          status: "ACTIVE",
          source: "ADMIN",
          startsAt: new Date("2026-08-15T00:00:00.000Z"),
          expiresAt: new Date("2026-10-14T00:00:00.000Z"),
          revokedAt: null,
          user: { name: "Ana, Beta", email: "ana@example.com" },
        },
      ],
      pagination: { page: 1, pageSize: 5000, total: 1, totalPages: 1 },
      filters: { query: "ana", status: "ACTIVE", source: "ADMIN" },
    });

    const response = await GET(new Request("http://localhost/api/admin/beta/grants/export?campaignId=campaign-1&q=ana&status=ACTIVE&source=ADMIN"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("mc-presupuestos-beta-grants-");
    expect(body).toContain("Grant,Usuario,Correo");
    expect(body).toContain('"Ana, Beta"');
    expect(mocks.listBetaGrants).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      query: "ana",
      status: "ACTIVE",
      source: "ADMIN",
      page: 1,
      pageSize: 5000,
    });
    expect(mocks.recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "admin-1",
      action: "BETA_GRANTS_EXPORTED",
      metadata: expect.objectContaining({ campaignId: "campaign-1", exportedRows: 1 }),
    }));
  });

  it("enforces the export rate limit", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.consumeRateLimit.mockResolvedValue({ allowed: false });

    const response = await GET(new Request("http://localhost/api/admin/beta/grants/export?campaignId=campaign-1"));

    expect(response.status).toBe(429);
    expect(mocks.listBetaGrants).not.toHaveBeenCalled();
  });
});
