import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  verifyAdminMfaCode: vi.fn(),
  consumeRateLimit: vi.fn(),
  getRateLimitHeaders: vi.fn(),
  getRequestClientIp: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/auth/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  getRateLimitHeaders: mocks.getRateLimitHeaders,
  getRequestClientIp: mocks.getRequestClientIp,
}));
vi.mock("@/lib/auth/admin-mfa", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/admin-mfa")>("@/lib/auth/admin-mfa");
  return {
    ...actual,
    verifyAdminMfaCode: mocks.verifyAdminMfaCode,
  };
});

import { POST } from "@/app/api/admin/mfa/verify/route";

describe("admin MFA verification route", () => {
  it("rejects invalid MFA codes", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 300 });
    mocks.getRequestClientIp.mockReturnValue("127.0.0.1");
    mocks.verifyAdminMfaCode.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/api/admin/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ code: "000000" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("accepts a valid code and issues a short-lived proof cookie", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 300 });
    mocks.getRequestClientIp.mockReturnValue("127.0.0.1");
    mocks.verifyAdminMfaCode.mockResolvedValue(true);

    const response = await POST(
      new Request("http://localhost/api/admin/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ code: "123456" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, expiresInSeconds: 600 });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=600");
  });

  it("returns 429 after the verification window is exhausted", async () => {
    mocks.verifyAdminMfaCode.mockClear();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.consumeRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 240 });
    mocks.getRateLimitHeaders.mockReturnValue({ "Retry-After": "240" });
    mocks.getRequestClientIp.mockReturnValue("127.0.0.1");

    const response = await POST(
      new Request("http://localhost/api/admin/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ code: "000000" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("240");
    expect(mocks.verifyAdminMfaCode).not.toHaveBeenCalled();
  });
});
