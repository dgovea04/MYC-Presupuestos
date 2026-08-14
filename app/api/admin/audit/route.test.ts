import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  listAdminAuditLogs: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/data/admin-audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/admin-audit")>("@/lib/data/admin-audit");
  return {
    ...actual,
    listAdminAuditLogs: mocks.listAdminAuditLogs,
  };
});

import { GET } from "@/app/api/admin/audit/route";

describe("admin audit route", () => {
  it("rejects users without audit permission", async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/audit"));

    expect(response.status).toBe(403);
    expect(mocks.listAdminAuditLogs).not.toHaveBeenCalled();
  });

  it("passes normalized filters to the audit data service", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.listAdminAuditLogs.mockResolvedValue({
      entries: [],
      actions: ["USER_SUSPENDED"],
      pagination: { page: 2, pageSize: 20, totalEntries: 21, totalPages: 2 },
      filters: { query: "test@example.com", action: "USER_SUSPENDED" },
    });

    const response = await GET(
      new Request("http://localhost/api/admin/audit?q=%20test%40example.com%20&action=USER_SUSPENDED&page=2&pageSize=20"),
    );

    expect(response.status).toBe(200);
    expect(mocks.listAdminAuditLogs).toHaveBeenCalledWith({
      query: "test@example.com",
      action: "USER_SUSPENDED",
      page: 2,
      pageSize: 20,
    });
  });
});
