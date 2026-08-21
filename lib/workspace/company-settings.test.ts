import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireWorkspaceOwner: vi.fn(),
  companyFindUnique: vi.fn(),
  companyFindFirst: vi.fn(),
  companyUpdate: vi.fn(),
  companyDeleteMany: vi.fn(),
  recordWorkspaceAudit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/workspace/authorization", () => ({
  requireWorkspaceOwner: mocks.requireWorkspaceOwner,
  requireWorkspaceRole: vi.fn(),
}));
vi.mock("@/lib/workspace/audit", () => ({ recordWorkspaceAudit: mocks.recordWorkspaceAudit }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    company: {
      findUnique: mocks.companyFindUnique,
      findFirst: mocks.companyFindFirst,
      update: mocks.companyUpdate,
      deleteMany: mocks.companyDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  deleteWorkspace,
  getWorkspaceDeletionRecoveryCutoff,
  purgeDeletedWorkspacesBefore,
  restoreWorkspace,
  WORKSPACE_DELETION_RECOVERY_DAYS,
} from "@/lib/workspace/company-settings";

function txWithCompany() {
  return { company: { update: mocks.companyUpdate } };
}

describe("workspace soft delete", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireWorkspaceOwner.mockResolvedValue(undefined);
    mocks.recordWorkspaceAudit.mockResolvedValue(undefined);
  });

  it("computes a recovery cutoff 30 days before now", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    const expected = new Date(now.getTime() - WORKSPACE_DELETION_RECOVERY_DAYS * 24 * 60 * 60 * 1000);

    expect(getWorkspaceDeletionRecoveryCutoff(now).toISOString()).toBe(expected.toISOString());
  });

  it("soft deletes a workspace by setting deletedAt", async () => {
    mocks.companyFindUnique.mockResolvedValue({ id: "company-1", name: "Mi Empresa", deletedAt: null, subscription: null });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(txWithCompany()));
    mocks.companyUpdate.mockResolvedValue({ id: "company-1", name: "Mi Empresa", deletedAt: new Date("2026-08-21T00:00:00.000Z") });

    const result = await deleteWorkspace({ companyId: "company-1", actorUserId: "user-1", confirmationName: "Mi Empresa" });

    expect(result.name).toBe("Mi Empresa");
    expect(mocks.companyUpdate).toHaveBeenCalledWith({ where: { id: "company-1" }, data: { deletedAt: expect.any(Date) } });
    expect(mocks.recordWorkspaceAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "WORKSPACE_DELETED" }),
      expect.anything(),
    );
  });

  it("restores a soft-deleted workspace within the recovery window", async () => {
    mocks.companyFindFirst.mockResolvedValue({
      id: "company-1",
      name: "Mi Empresa",
      userId: "user-1",
      deletedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(txWithCompany()));
    mocks.companyUpdate.mockResolvedValue({ id: "company-1", name: "Mi Empresa", deletedAt: null });

    const result = await restoreWorkspace({ companyId: "company-1", actorUserId: "user-1" });

    expect(result.name).toBe("Mi Empresa");
    expect(mocks.companyUpdate).toHaveBeenCalledWith({ where: { id: "company-1" }, data: { deletedAt: null } });
    expect(mocks.recordWorkspaceAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "WORKSPACE_RESTORED" }),
      expect.anything(),
    );
  });

  it("rejects restore by a non-owner", async () => {
    mocks.companyFindFirst.mockResolvedValue({
      id: "company-1",
      name: "Mi Empresa",
      userId: "other-user",
      deletedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    await expect(restoreWorkspace({ companyId: "company-1", actorUserId: "user-1" })).rejects.toThrow("Solo el Owner");
  });

  it("rejects restore after the recovery window expires", async () => {
    mocks.companyFindFirst.mockResolvedValue({
      id: "company-1",
      name: "Mi Empresa",
      userId: "user-1",
      deletedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });

    await expect(restoreWorkspace({ companyId: "company-1", actorUserId: "user-1" })).rejects.toThrow("expiró");
  });

  it("purges workspaces deleted before the cutoff", async () => {
    mocks.companyDeleteMany.mockResolvedValue({ count: 2 });

    const result = await purgeDeletedWorkspacesBefore({ now: new Date("2026-08-21T12:00:00.000Z") });

    expect(result.purgedCount).toBe(2);
    expect(mocks.companyDeleteMany).toHaveBeenCalledWith({ where: { deletedAt: { not: null, lt: expect.any(Date) } } });
  });
});
