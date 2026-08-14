import { describe, expect, it, vi } from "vitest";

const consumePasswordResetTokenMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/password-reset", () => ({
  consumePasswordResetToken: consumePasswordResetTokenMock,
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 900 }),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
  getRequestClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { POST } from "@/app/api/auth/password-reset/route";

describe("password reset route", () => {
  it("rejects an invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/password-reset", {
        method: "POST",
        body: JSON.stringify({ token: "", newPassword: "short", confirmPassword: "short" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(consumePasswordResetTokenMock).not.toHaveBeenCalled();
  });

  it("returns an error when the token is invalid or expired", async () => {
    consumePasswordResetTokenMock.mockResolvedValue({ status: "invalid" });

    const response = await POST(
      new Request("http://localhost/api/auth/password-reset", {
        method: "POST",
        body: JSON.stringify({ token: "token", newPassword: "new-password", confirmPassword: "new-password" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "El enlace no es valido o ya vencio." });
  });

  it("updates the password with a valid token", async () => {
    consumePasswordResetTokenMock.mockResolvedValue({ status: "updated" });

    const response = await POST(
      new Request("http://localhost/api/auth/password-reset", {
        method: "POST",
        body: JSON.stringify({ token: "token", newPassword: "new-password", confirmPassword: "new-password" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(consumePasswordResetTokenMock).toHaveBeenCalledWith("token", "new-password");
  });
});
