import { describe, expect, it, vi } from "vitest";

const requireAdminSessionMock = vi.hoisted(() => vi.fn());
const approveAdminUserDeletionMock = vi.hoisted(() => vi.fn());
const notifyMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: requireAdminSessionMock }));
vi.mock("@/lib/data/admin-deletion-approvals", () => ({ approveAdminUserDeletion: approveAdminUserDeletionMock }));
vi.mock("@/lib/auth/admin-security-alert", () => ({ notifyPrimaryAdminSecurityEvent: notifyMock }));

import { POST } from "@/app/api/admin/deletion-approvals/[id]/approve/route";

describe("admin deletion approval route", () => {
  it("returns forbidden without approval capability", async () => {
    requireAdminSessionMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/admin/deletion-approvals/a-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "a-1" }) },
    );

    expect(response.status).toBe(403);
    expect(approveAdminUserDeletionMock).not.toHaveBeenCalled();
  });

  it("executes an approved deletion and notifies the primary administrator", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "admin-2", email: "admin2@example.com" } });
    approveAdminUserDeletionMock.mockResolvedValue({
      targetEmail: "user@example.com",
      reason: "Duplicidad confirmada",
      scheduledAt: new Date("2026-08-14T12:15:00.000Z"),
    });

    const response = await POST(
      new Request("http://localhost/api/admin/deletion-approvals/a-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "a-1" }) },
    );

    expect(response.status).toBe(200);
    expect(approveAdminUserDeletionMock).toHaveBeenCalledWith("a-1", "admin-2", { ipAddress: null, userAgent: null });
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ action: "USER_DELETION_SCHEDULED" }));
  });
});
