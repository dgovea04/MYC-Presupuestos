import { describe, expect, it, vi } from "vitest";

const requireAdminSessionMock = vi.hoisted(() => vi.fn());
const executeAdminUserDeletionMock = vi.hoisted(() => vi.fn());
const notifyMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession: requireAdminSessionMock }));
vi.mock("@/lib/data/admin-deletion-approvals", () => ({ executeAdminUserDeletion: executeAdminUserDeletionMock }));
vi.mock("@/lib/auth/admin-security-alert", () => ({ notifyPrimaryAdminSecurityEvent: notifyMock }));

import { POST } from "@/app/api/admin/deletion-approvals/[id]/execute/route";

describe("admin deletion execution route", () => {
  it("returns forbidden when the MFA-protected session is unavailable", async () => {
    requireAdminSessionMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/admin/deletion-approvals/a-1/execute", { method: "POST" }),
      { params: Promise.resolve({ id: "a-1" }) },
    );

    expect(response.status).toBe(403);
    expect(executeAdminUserDeletionMock).not.toHaveBeenCalled();
  });

  it("executes an expired scheduled deletion and notifies the primary administrator", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "primary-1", email: "primary@example.com" } });
    executeAdminUserDeletionMock.mockResolvedValue({ targetEmail: "user@example.com", reason: "Cuenta duplicada confirmada" });

    const response = await POST(
      new Request("http://localhost/api/admin/deletion-approvals/a-1/execute", { method: "POST" }),
      { params: Promise.resolve({ id: "a-1" }) },
    );

    expect(response.status).toBe(200);
    expect(executeAdminUserDeletionMock).toHaveBeenCalledWith("a-1", "primary-1", { ipAddress: null, userAgent: null });
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ action: "USER_DELETED_PERMANENTLY", targetEmail: "user@example.com" }));
  });
});
