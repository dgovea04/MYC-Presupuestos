import { describe, expect, it, vi } from "vitest";

const requireAdminSessionMock = vi.hoisted(() => vi.fn());
const performBulkAdminUserActionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: requireAdminSessionMock }));
vi.mock("@/lib/data/admin-bulk-actions", () => ({ performBulkAdminUserAction: performBulkAdminUserActionMock }));

import { POST } from "@/app/api/admin/users/bulk/route";

describe("admin bulk users route", () => {
  it("rejects more than 50 users before authorization", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/users/bulk", {
        method: "POST",
        body: JSON.stringify({ userIds: Array.from({ length: 51 }, (_, index) => `user-${index}`), action: "SUSPEND" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(requireAdminSessionMock).not.toHaveBeenCalled();
  });

  it("uses lifecycle capability for suspension", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "admin-1" } });
    performBulkAdminUserActionMock.mockResolvedValue({ bulkId: "bulk-1", affectedUsers: 2 });

    const response = await POST(
      new Request("http://localhost/api/admin/users/bulk", {
        method: "POST",
        body: JSON.stringify({ userIds: ["user-1", "user-2"], action: "SUSPEND" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(requireAdminSessionMock).toHaveBeenCalledWith("users.manage_lifecycle");
    expect(performBulkAdminUserActionMock).toHaveBeenCalledWith(expect.objectContaining({ action: "SUSPEND", actorUserId: "admin-1" }));
  });

  it("uses session-revocation capability for bulk session invalidation", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "admin-1" } });
    performBulkAdminUserActionMock.mockResolvedValue({ bulkId: "bulk-2", affectedUsers: 1 });

    const response = await POST(
      new Request("http://localhost/api/admin/users/bulk", {
        method: "POST",
        body: JSON.stringify({ userIds: ["user-1"], action: "REVOKE_SESSIONS" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(requireAdminSessionMock).toHaveBeenCalledWith("users.revoke_sessions");
  });
});
