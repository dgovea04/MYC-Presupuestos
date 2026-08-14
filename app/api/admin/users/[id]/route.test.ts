import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/data/admin-users", () => ({
  updateUserAdminAccess: vi.fn(),
}));
vi.mock("@/lib/data/admin-deletion-approvals", () => ({
  requestAdminUserDeletion: vi.fn(),
}));
vi.mock("@/lib/auth/admin-security-alert", () => ({ notifyPrimaryAdminSecurityEvent: vi.fn().mockResolvedValue(false) }));

import { DELETE, PATCH } from "@/app/api/admin/users/[id]/route";
import { requireAdminSession } from "@/lib/auth/session";
import { updateUserAdminAccess } from "@/lib/data/admin-users";
import { requestAdminUserDeletion } from "@/lib/data/admin-deletion-approvals";

describe("admin user route", () => {
  it("returns 403 when the current user is not an admin", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "USER",
          status: "ACTIVE",
          membershipPlanSlug: "starter",
          aiTokenExtraMonthly: 0,
        }),
      }),
      { params: Promise.resolve({ id: "user-1" }) },
    );

    expect(response.status).toBe(403);
    expect(updateUserAdminAccess).not.toHaveBeenCalled();
  });

  it("requires a reason for permanent deletion", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } });

    const response = await DELETE(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationEmail: "test@example.com" }),
      }),
      { params: Promise.resolve({ id: "user-1" }) },
    );

    expect(response.status).toBe(400);
    expect(requestAdminUserDeletion).not.toHaveBeenCalled();
  });

  it("passes the confirmed reason to the permanent deletion service", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } });
    vi.mocked(requestAdminUserDeletion).mockResolvedValue({
      approvalId: "approval-1",
      targetEmail: "test@example.com",
      expiresAt: new Date("2026-08-14T12:15:00.000Z"),
    });

    const response = await DELETE(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationEmail: "test@example.com",
          reason: "Limpieza de usuario de pruebas local",
        }),
      }),
      { params: Promise.resolve({ id: "user-1" }) },
    );

    expect(response.status).toBe(202);
    expect(requestAdminUserDeletion).toHaveBeenCalledWith("user-1", "admin-1", "test@example.com", "Limpieza de usuario de pruebas local", {
      ipAddress: null,
      userAgent: null,
    });
  });
});
