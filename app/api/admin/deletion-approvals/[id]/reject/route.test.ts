import { describe, expect, it, vi } from "vitest";

const requireAdminSessionMock = vi.hoisted(() => vi.fn());
const rejectAdminUserDeletionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: requireAdminSessionMock }));
vi.mock("@/lib/data/admin-deletion-approvals", () => ({ rejectAdminUserDeletion: rejectAdminUserDeletionMock }));

import { POST } from "@/app/api/admin/deletion-approvals/[id]/reject/route";

describe("admin deletion rejection route", () => {
  it("returns forbidden without approval capability", async () => {
    requireAdminSessionMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/admin/deletion-approvals/a-1/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "a-1" }) },
    );

    expect(response.status).toBe(403);
    expect(rejectAdminUserDeletionMock).not.toHaveBeenCalled();
  });

  it("rejects a pending request", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "admin-2" } });
    rejectAdminUserDeletionMock.mockResolvedValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/admin/deletion-approvals/a-1/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "a-1" }) },
    );

    expect(response.status).toBe(200);
    expect(rejectAdminUserDeletionMock).toHaveBeenCalledWith("a-1", "admin-2", { ipAddress: null, userAgent: null });
  });
});
