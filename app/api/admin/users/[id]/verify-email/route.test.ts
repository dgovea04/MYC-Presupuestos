import { revalidatePath } from "next/cache";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/data/admin-users", () => ({
  verifyUserEmailManually: vi.fn(),
}));

import { PATCH } from "@/app/api/admin/users/[id]/verify-email/route";
import { requireAdminSession } from "@/lib/auth/session";
import { verifyUserEmailManually } from "@/lib/data/admin-users";

describe("admin user verify email route", () => {
  it("returns 403 when the current user is not an admin", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue(null);

    const response = await PATCH(new Request("http://localhost/api/admin/users/user-1/verify-email"), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(403);
    expect(verifyUserEmailManually).not.toHaveBeenCalled();
  });

  it("marks the selected user's email as verified for admins", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue({
      user: { id: "admin-1", email: "admin@example.com", name: "Admin", role: "ADMIN" },
      expires: "2026-12-31T00:00:00.000Z",
    });
    vi.mocked(verifyUserEmailManually).mockResolvedValue(undefined);

    const response = await PATCH(new Request("http://localhost/api/admin/users/user-1/verify-email"), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(verifyUserEmailManually).toHaveBeenCalledWith("user-1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });
});
