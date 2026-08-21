import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  purgeDeletedWorkspacesBefore: vi.fn(),
  recordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/workspace/company-settings", () => ({
  purgeDeletedWorkspacesBefore: mocks.purgeDeletedWorkspacesBefore,
  WORKSPACE_DELETION_RECOVERY_DAYS: 30,
}));
vi.mock("@/lib/data/admin-audit", () => ({ recordAdminAudit: mocks.recordAdminAudit }));

import { POST } from "@/app/api/admin/workspace-cleanup/route";

describe("admin workspace cleanup route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.purgeDeletedWorkspacesBefore.mockResolvedValue({ purgedCount: 4, cutoff: new Date("2026-07-22T00:00:00.000Z") });
    mocks.recordAdminAudit.mockResolvedValue(undefined);
  });

  it("rejects non-admin requests", async () => {
    mocks.requireAdminSession.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/admin/workspace-cleanup", { method: "POST" }));
    expect(response.status).toBe(403);
    expect(mocks.purgeDeletedWorkspacesBefore).not.toHaveBeenCalled();
  });

  it("purges expired workspaces and records an admin audit entry", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } });

    const response = await POST(new Request("http://localhost/api/admin/workspace-cleanup", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, purgedCount: 4, cutoff: "2026-07-22T00:00:00.000Z" });
    expect(mocks.recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "WORKSPACE_PURGE_EXECUTED" }));
  });

  it("returns 400 on failure", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } });
    mocks.purgeDeletedWorkspacesBefore.mockRejectedValue(new Error("boom"));

    const response = await POST(new Request("http://localhost/api/admin/workspace-cleanup", { method: "POST" }));

    expect(response.status).toBe(400);
  });
});
