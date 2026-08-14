import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
    $transaction: mocks.transaction,
  },
}));

import { performBulkAdminUserAction } from "@/lib/data/admin-bulk-actions";

describe("bulk admin user actions", () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
    mocks.executeRaw.mockReset();
    mocks.transaction.mockReset();
    mocks.transaction.mockImplementation(async (callback: (tx: { $executeRaw: typeof mocks.executeRaw }) => Promise<unknown>) =>
      callback({ $executeRaw: mocks.executeRaw }),
    );
  });

  it("limits a bulk operation to 50 users", async () => {
    await expect(
      performBulkAdminUserAction({
        userIds: Array.from({ length: 51 }, (_, index) => `user-${index}`),
        action: "SUSPEND",
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow("más de 50");
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("suspends selected users and audits every affected account", async () => {
    mocks.queryRaw
      .mockResolvedValueOnce([
        { id: "user-1", email: "one@example.com", role: "USER", status: "ACTIVE", isSuperAdmin: false },
        { id: "user-2", email: "two@example.com", role: "USER", status: "ACTIVE", isSuperAdmin: false },
      ])
      .mockResolvedValueOnce([{ count: 2n }]);
    mocks.executeRaw.mockResolvedValue(1);

    const result = await performBulkAdminUserAction({
      userIds: ["user-1", "user-2"],
      action: "SUSPEND",
      actorUserId: "admin-1",
    });

    expect(result.affectedUsers).toBe(2);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.executeRaw).toHaveBeenCalledTimes(4);
  });

  it("protects the primary administrator and the current account from bulk suspension", async () => {
    mocks.queryRaw.mockResolvedValueOnce([
      { id: "admin-1", email: "admin@example.com", role: "ADMIN", status: "ACTIVE", isSuperAdmin: false },
    ]);

    await expect(
      performBulkAdminUserAction({ userIds: ["admin-1"], action: "SUSPEND", actorUserId: "admin-1" }),
    ).rejects.toThrow("propia cuenta");

    mocks.queryRaw.mockReset();
    mocks.queryRaw.mockResolvedValueOnce([
      { id: "primary-1", email: "primary@example.com", role: "ADMIN", status: "ACTIVE", isSuperAdmin: true },
    ]);

    await expect(
      performBulkAdminUserAction({ userIds: ["primary-1"], action: "REACTIVATE", actorUserId: "admin-1" }),
    ).rejects.toThrow("administrador principal");
  });
});
