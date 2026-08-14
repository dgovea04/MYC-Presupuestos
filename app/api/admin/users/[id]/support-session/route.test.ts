import { describe, expect, it, vi } from "vitest";

const requireAdminSessionMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const getTargetMock = vi.hoisted(() => vi.fn());
const auditMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: requireAdminSessionMock }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeRateLimit: consumeRateLimitMock, getRequestClientIp: vi.fn().mockReturnValue("127.0.0.1") }));
vi.mock("@/lib/data/admin-support", () => ({ getAdminSupportTarget: getTargetMock, recordAdminSupportAudit: auditMock }));

import { POST } from "@/app/api/admin/users/[id]/support-session/route";

describe("support session start route", () => {
  it("rejects users without the impersonation capability", async () => {
    requireAdminSessionMock.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: "user-1" }) });

    expect(response.status).toBe(403);
    expect(getTargetMock).not.toHaveBeenCalled();
  });

  it("starts a short-lived support session for an eligible user", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } });
    consumeRateLimitMock.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 3600 });
    getTargetMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    auditMock.mockResolvedValue(undefined);

    const response = await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: "user-1" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("myc-presupuestos.admin-support=");
    await expect(response.json()).resolves.toEqual({ ok: true, redirectTo: "/admin/support/user-1" });
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "USER_SUPPORT_SESSION_STARTED", targetUserId: "user-1" }));
  });
});
