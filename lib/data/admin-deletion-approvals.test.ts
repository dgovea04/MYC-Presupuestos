import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  transaction: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/auth/admin-security-alert", () => ({
  notifyPrimaryAdminSecurityEvent: mocks.notify,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
    $transaction: mocks.transaction,
  },
}));

import {
  approveAdminUserDeletion,
  executeAdminUserDeletion,
  rejectAdminUserDeletion,
  requestAdminUserDeletion,
  restoreAdminUserDeletion,
  notifyDueAdminDeletions,
} from "@/lib/data/admin-deletion-approvals";

describe("admin deletion approvals", () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
    mocks.executeRaw.mockReset();
    mocks.transaction.mockReset();
    mocks.notify.mockReset();
  });

  it("creates a pending request only for the protected administrator", async () => {
    mocks.queryRaw
      .mockResolvedValueOnce([{ isSuperAdmin: true, status: "ACTIVE" }])
      .mockResolvedValueOnce([{ email: "user@example.com", isSuperAdmin: false }]);
    mocks.transaction.mockImplementation(async (callback: (tx: { $queryRaw: typeof mocks.queryRaw; $executeRaw: typeof mocks.executeRaw }) => Promise<unknown>) =>
      callback({ $queryRaw: mocks.queryRaw, $executeRaw: mocks.executeRaw }),
    );
    mocks.executeRaw.mockResolvedValue(1);

    const result = await requestAdminUserDeletion(
      "user-1",
      "primary-1",
      "user@example.com",
      "Solicitud de eliminación por duplicidad de cuenta",
    );

    expect(result.approvalId).toEqual(expect.any(String));
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.executeRaw).toHaveBeenCalledTimes(3);
  });

  it("requires a different active administrator to schedule the deletion", async () => {
    const approval = {
      id: "approval-1",
      targetUserId: "user-1",
      targetEmail: "user@example.com",
      requestedById: "primary-1",
      requestedByEmail: "primary@example.com",
      confirmationEmail: "user@example.com",
      reason: "Cuenta duplicada confirmada por soporte",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    };
    mocks.queryRaw
      .mockResolvedValueOnce([{ email: "admin@example.com", status: "ACTIVE", role: "ADMIN" }])
      .mockResolvedValueOnce([approval]);
    mocks.transaction.mockImplementation(async (callback: (tx: { $queryRaw: typeof mocks.queryRaw; $executeRaw: typeof mocks.executeRaw }) => Promise<unknown>) => {
      mocks.queryRaw.mockResolvedValueOnce([{ id: "user-1" }]);
      return callback({ $queryRaw: mocks.queryRaw, $executeRaw: mocks.executeRaw });
    });
    mocks.executeRaw.mockResolvedValue(1);

    const result = await approveAdminUserDeletion("approval-1", "admin-1");

    expect(result.targetEmail).toBe("user@example.com");
    expect(result.reason).toBe(approval.reason);
    expect(result.scheduledAt).toBeInstanceOf(Date);
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("does not allow the requester to approve or reject their own request", async () => {
    const approval = {
      id: "approval-1",
      targetUserId: "user-1",
      targetEmail: "user@example.com",
      requestedById: "admin-1",
      requestedByEmail: "admin@example.com",
      confirmationEmail: "user@example.com",
      reason: "Cuenta duplicada confirmada por soporte",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    };
    mocks.queryRaw.mockResolvedValueOnce([{ email: "admin@example.com", status: "ACTIVE", role: "ADMIN" }]).mockResolvedValueOnce([approval]);

    await expect(approveAdminUserDeletion("approval-1", "admin-1")).rejects.toThrow("no puede aprobarla");

    mocks.queryRaw.mockReset();
    mocks.queryRaw.mockResolvedValueOnce([{ email: "admin@example.com", status: "ACTIVE", role: "ADMIN" }]).mockResolvedValueOnce([approval]);
    await expect(rejectAdminUserDeletion("approval-1", "admin-1")).rejects.toThrow("no puede rechazarla");
  });

  it("restores only a scheduled account still inside the grace period", async () => {
    const approval = {
      id: "approval-1",
      targetUserId: "user-1",
      targetEmail: "user@example.com",
      requestedById: "primary-1",
      requestedByEmail: null,
      confirmationEmail: "user@example.com",
      reason: "Cuenta duplicada confirmada por soporte",
      status: "SCHEDULED",
      expiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date(),
    };
    mocks.queryRaw.mockResolvedValueOnce([{ email: "primary@example.com", status: "ACTIVE", isSuperAdmin: true }]).mockResolvedValueOnce([approval]);
    mocks.transaction.mockImplementation(async (callback: (tx: { $executeRaw: typeof mocks.executeRaw }) => Promise<unknown>) => callback({ $executeRaw: mocks.executeRaw }));
    mocks.executeRaw.mockResolvedValue(1);

    const result = await restoreAdminUserDeletion("approval-1", "primary-1");

    expect(result).toEqual({ targetEmail: "user@example.com" });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("does not restore an account after the grace period expires", async () => {
    const approval = {
      id: "approval-1",
      targetUserId: "user-1",
      targetEmail: "user@example.com",
      requestedById: "primary-1",
      requestedByEmail: null,
      confirmationEmail: "user@example.com",
      reason: "Cuenta duplicada confirmada por soporte",
      status: "SCHEDULED",
      expiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date(),
    };
    mocks.queryRaw.mockResolvedValueOnce([{ email: "primary@example.com", status: "ACTIVE", isSuperAdmin: true }]).mockResolvedValueOnce([approval]);
    mocks.transaction.mockImplementation(async (callback: (tx: { $executeRaw: typeof mocks.executeRaw }) => Promise<unknown>) => callback({ $executeRaw: mocks.executeRaw }));
    mocks.executeRaw.mockResolvedValue(0);

    await expect(restoreAdminUserDeletion("approval-1", "primary-1")).rejects.toThrow("La cuenta ya no está pendiente");
  });

  it("requires the grace period to expire before permanent execution", async () => {
    const approval = {
      id: "approval-1",
      targetUserId: "user-1",
      targetEmail: "user@example.com",
      requestedById: "primary-1",
      requestedByEmail: null,
      confirmationEmail: "user@example.com",
      reason: "Cuenta duplicada confirmada por soporte",
      status: "SCHEDULED",
      expiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date(),
      deletionScheduledAt: new Date(Date.now() + 60_000),
    };
    mocks.queryRaw.mockResolvedValueOnce([{ email: "primary@example.com", status: "ACTIVE", isSuperAdmin: true }]).mockResolvedValueOnce([approval]);

    await expect(executeAdminUserDeletion("approval-1", "primary-1")).rejects.toThrow("todavía no ha vencido");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("executes a scheduled deletion after the grace period expires", async () => {
    const approval = {
      id: "approval-1",
      targetUserId: "user-1",
      targetEmail: "user@example.com",
      requestedById: "primary-1",
      requestedByEmail: null,
      confirmationEmail: "user@example.com",
      reason: "Cuenta duplicada confirmada por soporte",
      status: "SCHEDULED",
      expiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date(),
      deletionScheduledAt: new Date(Date.now() - 60_000),
    };
    mocks.queryRaw.mockResolvedValueOnce([{ email: "primary@example.com", status: "ACTIVE", isSuperAdmin: true }]).mockResolvedValueOnce([approval]);
    mocks.transaction.mockImplementation(async (callback: (tx: { $executeRaw: typeof mocks.executeRaw }) => Promise<unknown>) => callback({ $executeRaw: mocks.executeRaw }));
    mocks.executeRaw.mockResolvedValue(1);

    const result = await executeAdminUserDeletion("approval-1", "primary-1");

    expect(result).toEqual({ targetEmail: "user@example.com", reason: approval.reason });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("notifies each due deletion once and keeps the reason out of execution", async () => {
    mocks.queryRaw.mockResolvedValueOnce([{ id: "approval-1", targetEmail: "user@example.com", reason: "Cuenta duplicada confirmada" }]);
    mocks.executeRaw.mockResolvedValueOnce(1);
    mocks.notify.mockResolvedValueOnce(true);

    const result = await notifyDueAdminDeletions();

    expect(result).toEqual({ checked: 1, sent: 1, failed: 0 });
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ action: "USER_DELETION_READY", targetEmail: "user@example.com" }));
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
  });

  it("does not send a reminder when another worker claimed it", async () => {
    mocks.queryRaw.mockResolvedValueOnce([{ id: "approval-1", targetEmail: "user@example.com", reason: "Cuenta duplicada confirmada" }]);
    mocks.executeRaw.mockResolvedValueOnce(0);

    const result = await notifyDueAdminDeletions();

    expect(result).toEqual({ checked: 1, sent: 0, failed: 0 });
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("rejects an expired approval", async () => {
    mocks.queryRaw
      .mockResolvedValueOnce([{ email: "admin@example.com", status: "ACTIVE", role: "ADMIN" }])
      .mockResolvedValueOnce([]);
    mocks.executeRaw.mockResolvedValue(1);

    await expect(approveAdminUserDeletion("expired-1", "admin-1")).rejects.toThrow("ya no está pendiente");
  });
});
