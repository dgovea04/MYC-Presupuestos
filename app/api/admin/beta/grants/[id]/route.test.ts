import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  revokeBetaGrant: vi.fn(),
  extendBetaGrant: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  getWorkspaceLicenseCacheTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/beta/assignments", () => ({
  revokeBetaGrant: mocks.revokeBetaGrant,
  extendBetaGrant: mocks.extendBetaGrant,
}));
vi.mock("@/lib/workspace/entitlements", () => ({
  getWorkspaceLicenseCacheTag: mocks.getWorkspaceLicenseCacheTag,
}));

import { PATCH } from "@/app/api/admin/beta/grants/[id]/route";

describe("admin beta grant route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getWorkspaceLicenseCacheTag.mockReturnValue("workspace-license:user-1:company-1");
  });

  it("rejects malformed grant actions before authorization", async () => {
    const response = await PATCH(new Request("http://localhost/api/admin/beta/grants/grant-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REVOKE", reason: "corto" }),
    }), { params: Promise.resolve({ id: "grant-1" }) });

    expect(response.status).toBe(400);
    expect(mocks.requireAdminSession).not.toHaveBeenCalled();
  });

  it("requires revoke permission", async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await PATCH(new Request("http://localhost/api/admin/beta/grants/grant-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REVOKE", reason: "Revocación solicitada por soporte" }),
    }), { params: Promise.resolve({ id: "grant-1" }) });

    expect(response.status).toBe(403);
    expect(mocks.revokeBetaGrant).not.toHaveBeenCalled();
  });

  it("revokes a grant and invalidates the affected workspace", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.revokeBetaGrant.mockResolvedValue({ userId: "user-1", companyId: "company-1" });

    const response = await PATCH(new Request("http://localhost/api/admin/beta/grants/grant-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REVOKE", reason: "Revocación solicitada por soporte" }),
    }), { params: Promise.resolve({ id: "grant-1" }) });

    expect(response.status).toBe(200);
    expect(mocks.revokeBetaGrant).toHaveBeenCalledWith({
      grantId: "grant-1",
      actorUserId: "admin-1",
      reason: "Revocación solicitada por soporte",
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("workspace-license:user-1:company-1", "max");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
