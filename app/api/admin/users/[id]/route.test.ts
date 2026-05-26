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

import { PATCH } from "@/app/api/admin/users/[id]/route";
import { requireAdminSession } from "@/lib/auth/session";
import { updateUserAdminAccess } from "@/lib/data/admin-users";

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
});
