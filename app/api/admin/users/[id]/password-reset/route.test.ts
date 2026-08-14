import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSuperAdminSession: vi.fn(),
  requestAdminPasswordReset: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireSuperAdminSession: mocks.requireSuperAdminSession,
}));

vi.mock("@/lib/data/admin-users", () => ({
  requestAdminPasswordReset: mocks.requestAdminPasswordReset,
}));

import { POST } from "@/app/api/admin/users/[id]/password-reset/route";

describe("admin password reset route", () => {
  it("rejects non-primary administrators", async () => {
    mocks.requireSuperAdminSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/admin/users/user-1/password-reset"), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.requestAdminPasswordReset).not.toHaveBeenCalled();
  });

  it("requests a reset link for the selected user", async () => {
    mocks.requireSuperAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.requestAdminPasswordReset.mockResolvedValue({ expiresAt: new Date("2026-08-14T12:30:00.000Z") });

    const response = await POST(new Request("http://localhost/api/admin/users/user-1/password-reset"), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, expiresAt: "2026-08-14T12:30:00.000Z" });
    expect(mocks.requestAdminPasswordReset).toHaveBeenCalledWith("user-1", "admin-1", {
      ipAddress: null,
      userAgent: null,
    });
  });
});
