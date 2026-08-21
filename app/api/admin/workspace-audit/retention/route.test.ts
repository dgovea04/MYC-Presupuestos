import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  purgeWorkspaceAuditEventsBefore: vi.fn(),
  recordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/workspace/audit-retention", () => ({
  purgeWorkspaceAuditEventsBefore: mocks.purgeWorkspaceAuditEventsBefore,
  WORKSPACE_AUDIT_RETENTION_MONTHS: 24,
}));
vi.mock("@/lib/data/admin-audit", () => ({ recordAdminAudit: mocks.recordAdminAudit }));

import { POST } from "@/app/api/admin/workspace-audit/retention/route";

describe("workspace audit retention route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.purgeWorkspaceAuditEventsBefore.mockResolvedValue({ purgedCount: 3, cutoff: new Date("2024-08-21T00:00:00.000Z") });
    mocks.recordAdminAudit.mockResolvedValue(undefined);
  });

  it("rejects non-admin requests", async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/admin/workspace-audit/retention", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(mocks.purgeWorkspaceAuditEventsBefore).not.toHaveBeenCalled();
  });

  it("purges old events and records an admin audit entry", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } });

    const response = await POST(new Request("http://localhost/api/admin/workspace-audit/retention", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, purgedCount: 3, cutoff: "2024-08-21T00:00:00.000Z" });
    expect(mocks.recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "WORKSPACE_AUDIT_RETENTION_PURGED" }));
  });

  it("returns 400 when the purge fails", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } });
    mocks.purgeWorkspaceAuditEventsBefore.mockRejectedValue(new Error("boom"));

    const response = await POST(new Request("http://localhost/api/admin/workspace-audit/retention", { method: "POST" }));

    expect(response.status).toBe(400);
  });
});
