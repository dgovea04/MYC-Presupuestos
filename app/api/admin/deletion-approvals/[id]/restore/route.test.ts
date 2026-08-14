import { describe, expect, it, vi } from "vitest";

const requireAdminSessionMock = vi.hoisted(() => vi.fn());
const restoreAdminUserDeletionMock = vi.hoisted(() => vi.fn());
const notifyMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession: requireAdminSessionMock }));
vi.mock("@/lib/data/admin-deletion-approvals", () => ({ restoreAdminUserDeletion: restoreAdminUserDeletionMock }));
vi.mock("@/lib/auth/admin-security-alert", () => ({ notifyPrimaryAdminSecurityEvent: notifyMock }));

import { POST } from "@/app/api/admin/deletion-approvals/[id]/restore/route";

describe("admin deletion restore route", () => {
  it("returns forbidden when the MFA-protected session is unavailable", async () => {
    requireAdminSessionMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/admin/deletion-approvals/a-1/restore", { method: "POST" }),
      { params: Promise.resolve({ id: "a-1" }) },
    );

    expect(response.status).toBe(403);
    expect(restoreAdminUserDeletionMock).not.toHaveBeenCalled();
  });

  it("restores the scheduled account and sends a security alert", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "primary-1", email: "primary@example.com" } });
    restoreAdminUserDeletionMock.mockResolvedValue({ targetEmail: "user@example.com" });

    const response = await POST(
      new Request("http://localhost/api/admin/deletion-approvals/a-1/restore", { method: "POST" }),
      { params: Promise.resolve({ id: "a-1" }) },
    );

    expect(response.status).toBe(200);
    expect(restoreAdminUserDeletionMock).toHaveBeenCalledWith("a-1", "primary-1", { ipAddress: null, userAgent: null });
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ action: "USER_DELETION_RESTORED", targetEmail: "user@example.com" }));
  });
});
