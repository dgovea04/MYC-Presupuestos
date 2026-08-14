import { describe, expect, it, vi } from "vitest";

const getBaseSessionMock = vi.hoisted(() => vi.fn());
const getTokenMock = vi.hoisted(() => vi.fn());
const verifyMock = vi.hoisted(() => vi.fn());
const getTargetMock = vi.hoisted(() => vi.fn());
const auditMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getBaseAuthSession: getBaseSessionMock }));
vi.mock("@/lib/auth/admin-support-session", () => ({
  ADMIN_SUPPORT_SESSION_COOKIE_NAME: "myc-presupuestos.admin-support",
  getAdminSupportSessionFromRequest: getTokenMock,
  verifyAdminSupportSession: verifyMock,
}));
vi.mock("@/lib/data/admin-support", () => ({ getAdminSupportTarget: getTargetMock, recordAdminSupportAudit: auditMock }));

import { POST } from "@/app/api/admin/support-session/stop/route";

describe("support session stop route", () => {
  it("clears the cookie and records the stop event", async () => {
    getBaseSessionMock.mockResolvedValue({ user: { id: "admin-1" } });
    getTokenMock.mockReturnValue("signed-token");
    verifyMock.mockReturnValue({ adminUserId: "admin-1", targetUserId: "user-1" });
    getTargetMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    auditMock.mockResolvedValue(undefined);

    const response = await POST(new Request("http://localhost", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "USER_SUPPORT_SESSION_STOPPED", targetUserId: "user-1" }));
  });
});
