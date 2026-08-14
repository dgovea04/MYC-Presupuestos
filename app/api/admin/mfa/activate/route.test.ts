import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  activateAdminMfa: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/auth/rate-limit", () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 600 }),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
  getRequestClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("@/lib/auth/admin-security-alert", () => ({ notifyPrimaryAdminSecurityEvent: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/auth/admin-mfa", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/admin-mfa")>("@/lib/auth/admin-mfa");
  return {
    ...actual,
    activateAdminMfa: mocks.activateAdminMfa,
  };
});

import { POST } from "@/app/api/admin/mfa/activate/route";

describe("admin MFA activation route", () => {
  it("rejects unauthenticated users", async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/admin/mfa/activate", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(mocks.activateAdminMfa).not.toHaveBeenCalled();
  });

  it("activates MFA and issues a step-up cookie", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.activateAdminMfa.mockResolvedValue({ status: "enabled", recoveryCodes: ["ABCD-EFGH-IJKL"] });

    const response = await POST(
      new Request("http://localhost/api/admin/mfa/activate", {
        method: "POST",
        body: JSON.stringify({ code: "123456" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, recoveryCodes: ["ABCD-EFGH-IJKL"] });
    expect(response.headers.get("set-cookie")).toContain("myc-presupuestos.admin-mfa=");
    expect(mocks.activateAdminMfa).toHaveBeenCalledWith("admin-1", "123456");
  });
});
