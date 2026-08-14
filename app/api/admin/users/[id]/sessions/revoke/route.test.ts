import { describe, expect, it, vi } from "vitest";

const requireAdminSessionMock = vi.hoisted(() => vi.fn());
const revokeAdminUserSessionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/lib/data/admin-users", () => ({
  revokeAdminUserSessions: revokeAdminUserSessionsMock,
}));

import { POST } from "@/app/api/admin/users/[id]/sessions/revoke/route";

describe("admin session revocation route", () => {
  it("returns forbidden without the required capability", async () => {
    requireAdminSessionMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/sessions/revoke", { method: "POST" }),
      { params: Promise.resolve({ id: "user-1" }) },
    );

    expect(response.status).toBe(403);
    expect(revokeAdminUserSessionsMock).not.toHaveBeenCalled();
  });

  it("revokes all sessions for the selected user", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "admin-1" } });
    revokeAdminUserSessionsMock.mockResolvedValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/sessions/revoke", {
        method: "POST",
        headers: { "user-agent": "vitest" },
      }),
      { params: Promise.resolve({ id: "user-1" }) },
    );

    expect(response.status).toBe(200);
    expect(revokeAdminUserSessionsMock).toHaveBeenCalledWith("user-1", "admin-1", {
      ipAddress: null,
      userAgent: "vitest",
    });
  });
});
