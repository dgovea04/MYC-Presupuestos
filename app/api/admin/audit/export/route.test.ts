import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  listAdminAuditLogs: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/auth/rate-limit", () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 600 }),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
  getRequestClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("@/lib/data/admin-audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/admin-audit")>("@/lib/data/admin-audit");
  return {
    ...actual,
    listAdminAuditLogs: mocks.listAdminAuditLogs,
  };
});

import { GET } from "@/app/api/admin/audit/export/route";

describe("admin audit export route", () => {
  it("rejects users without audit permission", async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/audit/export"));

    expect(response.status).toBe(403);
  });

  it("exports filtered records as CSV with escaped details", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.listAdminAuditLogs.mockResolvedValue({
      entries: [{
        id: "audit-1",
        action: "USER_SUSPENDED",
        targetEmail: "test@example.com",
        actorEmail: "admin@example.com",
        detail: "Motivo: prueba, temporal",
        createdAt: "2026-08-14T12:00:00.000Z",
      }],
      actions: [],
      pagination: { page: 1, pageSize: 5000, totalEntries: 1, totalPages: 1 },
      filters: { query: "", action: "" },
    });

    const response = await GET(new Request("http://localhost/api/admin/audit/export?action=USER_SUSPENDED"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(body).toContain('"Motivo: prueba, temporal"');
    expect(mocks.listAdminAuditLogs).toHaveBeenCalledWith({
      query: undefined,
      action: "USER_SUSPENDED",
      page: 1,
      pageSize: 5000,
    });
  });
});
