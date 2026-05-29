import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/data/admin-users", () => ({
  activateManualProRequest: vi.fn(),
}));

import { POST } from "@/app/api/admin/billing/manual-requests/[id]/activate/route";
import { requireAdminSession } from "@/lib/auth/session";
import { activateManualProRequest } from "@/lib/data/admin-users";

describe("admin manual payment activation route", () => {
  it("returns 403 when the current user is not admin", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/admin/billing/manual-requests/request-1/activate"), {
      params: Promise.resolve({ id: "request-1" }),
    });

    expect(response.status).toBe(403);
    expect(activateManualProRequest).not.toHaveBeenCalled();
  });

  it("activates a pending manual request", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });

    const response = await POST(new Request("http://localhost/api/admin/billing/manual-requests/request-1/activate"), {
      params: Promise.resolve({ id: "request-1" }),
    });

    expect(response.status).toBe(200);
    expect(activateManualProRequest).toHaveBeenCalledWith("request-1");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
