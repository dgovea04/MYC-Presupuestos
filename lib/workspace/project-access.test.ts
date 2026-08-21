import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveWorkspaceCapabilities: vi.fn(),
  requireWorkspaceRole: vi.fn(),
  requireWorkspaceCapability: vi.fn(),
  recordWorkspaceAudit: vi.fn(),
  projectFindUnique: vi.fn(),
  projectMembershipFindMany: vi.fn(),
  projectMembershipFindUnique: vi.fn(),
  projectMembershipUpsert: vi.fn(),
  projectMembershipDeleteMany: vi.fn(),
  companyMembershipFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/workspace/permissions", () => ({
  resolveWorkspaceCapabilities: mocks.resolveWorkspaceCapabilities,
}));

vi.mock("@/lib/workspace/authorization", () => ({
  requireWorkspaceRole: mocks.requireWorkspaceRole,
  requireWorkspaceCapability: mocks.requireWorkspaceCapability,
  WorkspaceAuthorizationError: class WorkspaceAuthorizationError extends Error {},
}));

vi.mock("@/lib/workspace/audit", () => ({
  recordWorkspaceAudit: mocks.recordWorkspaceAudit,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: { findUnique: mocks.projectFindUnique },
    projectMembership: {
      findMany: mocks.projectMembershipFindMany,
      findUnique: mocks.projectMembershipFindUnique,
      upsert: mocks.projectMembershipUpsert,
      deleteMany: mocks.projectMembershipDeleteMany,
    },
    companyMembership: { findUnique: mocks.companyMembershipFindUnique },
    $transaction: mocks.transaction,
  },
}));

import {
  getProjectAccessScope,
  listProjectAccess,
  projectAccessWhere,
  requireProjectCapability,
  requireProjectRole,
  revokeProjectAccess,
  shareProjectAccess,
} from "@/lib/workspace/project-access";

function txWithProjectMembership() {
  return { projectMembership: { upsert: mocks.projectMembershipUpsert, deleteMany: mocks.projectMembershipDeleteMany } };
}

describe("projectAccessWhere", () => {
  it("lets base-role active members see projects without explicit shares", () => {
    const where = projectAccessWhere("user-1");
    expect(where).toMatchObject({
      OR: expect.arrayContaining([
        { company: { memberships: { some: { userId: "user-1", status: "ACTIVE", customRoleId: null } } } },
      ]),
    });
  });

  it("lets custom roles with projects.read see projects", () => {
    const where = projectAccessWhere("user-1");
    expect(where).toMatchObject({
      OR: expect.arrayContaining([
        {
          company: {
            memberships: {
              some: { userId: "user-1", status: "ACTIVE", customRole: { permissions: { some: { permissionKey: "projects.read" } } } },
            },
          },
        },
      ]),
    });
  });

  it("requires active membership plus explicit share for restricted members", () => {
    const where = projectAccessWhere("user-1");
    expect(where).toMatchObject({
      OR: expect.arrayContaining([
        {
          company: { memberships: { some: { userId: "user-1", status: "ACTIVE" } } },
          projectMemberships: { some: { userId: "user-1" } },
        },
      ]),
    });
  });
});

describe("getProjectAccessScope", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns unrestricted when the member can read projects", async () => {
    mocks.resolveWorkspaceCapabilities.mockResolvedValue({ capabilities: new Set(["projects.read"]), role: "VIEWER", customRoleId: null });

    const scope = await getProjectAccessScope({ userId: "user-1", companyId: "company-1" });

    expect(scope).toEqual({ restricted: false, grantedProjectIds: null });
    expect(mocks.projectMembershipFindMany).not.toHaveBeenCalled();
  });

  it("returns the granted project ids for restricted members", async () => {
    mocks.resolveWorkspaceCapabilities.mockResolvedValue({ capabilities: new Set([]), role: "VIEWER", customRoleId: "role-1" });
    mocks.projectMembershipFindMany.mockResolvedValue([{ projectId: "project-1" }, { projectId: "project-2" }]);

    const scope = await getProjectAccessScope({ userId: "user-1", companyId: "company-1" });

    expect(scope).toEqual({ restricted: true, grantedProjectIds: ["project-1", "project-2"] });
    expect(mocks.projectMembershipFindMany).toHaveBeenCalledWith({
      where: { companyId: "company-1", userId: "user-1" },
      select: { projectId: true },
    });
  });
});

describe("requireProjectRole", () => {
  beforeEach(() => vi.resetAllMocks());

  it("does not enforce project grants for unrestricted members", async () => {
    mocks.resolveWorkspaceCapabilities.mockResolvedValue({ capabilities: new Set(["projects.read"]), role: "EDITOR", customRoleId: null });

    await expect(requireProjectRole({ userId: "user-1", companyId: "company-1", projectId: "project-1" })).resolves.toEqual({
      restricted: false,
      role: null,
    });
  });

  it("throws when a restricted member has no grant", async () => {
    mocks.resolveWorkspaceCapabilities.mockResolvedValue({ capabilities: new Set([]), role: "VIEWER", customRoleId: "role-1" });
    mocks.projectMembershipFindMany.mockResolvedValue([]);
    mocks.projectMembershipFindUnique.mockResolvedValue(null);

    await expect(requireProjectRole({ userId: "user-1", companyId: "company-1", projectId: "project-1" })).rejects.toThrow(
      "No tienes acceso a este proyecto",
    );
  });

  it("enforces minimum project role", async () => {
    mocks.resolveWorkspaceCapabilities.mockResolvedValue({ capabilities: new Set([]), role: "VIEWER", customRoleId: "role-1" });
    mocks.projectMembershipFindMany.mockResolvedValue([{ projectId: "project-1" }]);
    mocks.projectMembershipFindUnique.mockResolvedValue({ role: "VIEWER" });

    await expect(
      requireProjectRole({ userId: "user-1", companyId: "company-1", projectId: "project-1", minimumRole: "EDITOR" }),
    ).rejects.toThrow("No tienes el rol necesario en este proyecto");
  });
});

describe("requireProjectCapability", () => {
  beforeEach(() => vi.resetAllMocks());

  it("enforces the workspace capability for unrestricted members", async () => {
    mocks.resolveWorkspaceCapabilities.mockResolvedValue({ capabilities: new Set(["projects.read"]), role: "EDITOR", customRoleId: null });

    await expect(
      requireProjectCapability({ userId: "user-1", companyId: "company-1", projectId: "project-1", capability: "budgets.update" }),
    ).resolves.toEqual({ restricted: false, role: null });

    expect(mocks.requireWorkspaceCapability).toHaveBeenCalledWith({ userId: "user-1", companyId: "company-1", capability: "budgets.update" });
    expect(mocks.projectMembershipFindUnique).not.toHaveBeenCalled();
  });

  it("enforces the project grant for restricted members", async () => {
    mocks.resolveWorkspaceCapabilities.mockResolvedValue({ capabilities: new Set([]), role: "VIEWER", customRoleId: "role-1" });
    mocks.projectMembershipFindMany.mockResolvedValue([{ projectId: "project-1" }]);
    mocks.projectMembershipFindUnique.mockResolvedValue({ role: "EDITOR" });

    await expect(
      requireProjectCapability({ userId: "user-1", companyId: "company-1", projectId: "project-1", capability: "budgets.update", minimumProjectRole: "EDITOR" }),
    ).resolves.toEqual({ restricted: true, role: "EDITOR" });

    expect(mocks.requireWorkspaceCapability).not.toHaveBeenCalled();
  });

  it("rejects a restricted member with an insufficient project role", async () => {
    mocks.resolveWorkspaceCapabilities.mockResolvedValue({ capabilities: new Set([]), role: "VIEWER", customRoleId: "role-1" });
    mocks.projectMembershipFindMany.mockResolvedValue([{ projectId: "project-1" }]);
    mocks.projectMembershipFindUnique.mockResolvedValue({ role: "VIEWER" });

    await expect(
      requireProjectCapability({ userId: "user-1", companyId: "company-1", projectId: "project-1", capability: "budgets.update", minimumProjectRole: "EDITOR" }),
    ).rejects.toThrow("No tienes el rol necesario en este proyecto");
  });

  it("rejects a restricted member without a project grant", async () => {
    mocks.resolveWorkspaceCapabilities.mockResolvedValue({ capabilities: new Set([]), role: "VIEWER", customRoleId: "role-1" });
    mocks.projectMembershipFindMany.mockResolvedValue([]);
    mocks.projectMembershipFindUnique.mockResolvedValue(null);

    await expect(
      requireProjectCapability({ userId: "user-1", companyId: "company-1", projectId: "project-1", capability: "budgets.update", minimumProjectRole: "EDITOR" }),
    ).rejects.toThrow("No tienes acceso a este proyecto");
  });
});

describe("shareProjectAccess", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects sharing with members who already have full workspace access", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "project-1", companyId: "company-1", name: "Hospital Norte" });
    mocks.companyMembershipFindUnique.mockResolvedValue({ role: "OWNER", status: "ACTIVE" });

    await expect(
      shareProjectAccess({ actorUserId: "user-1", projectId: "project-1", userId: "user-2", role: "VIEWER" }),
    ).rejects.toThrow("Este miembro ya tiene acceso completo al workspace");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("upserts the grant and records an audit event", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "project-1", companyId: "company-1", name: "Hospital Norte" });
    mocks.companyMembershipFindUnique.mockResolvedValue({ role: "VIEWER", status: "ACTIVE" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(txWithProjectMembership()));
    mocks.projectMembershipUpsert.mockResolvedValue({ id: "pm-1", userId: "user-2", role: "VIEWER" });

    const result = await shareProjectAccess({ actorUserId: "user-1", projectId: "project-1", userId: "user-2", role: "EDITOR" });

    expect(result).toEqual({ id: "pm-1", userId: "user-2", role: "VIEWER" });
    expect(mocks.projectMembershipUpsert).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: "project-1", userId: "user-2" } },
      update: { role: "EDITOR" },
      create: { projectId: "project-1", companyId: "company-1", userId: "user-2", role: "EDITOR" },
    });
    expect(mocks.recordWorkspaceAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PROJECT_SHARED", targetType: "PROJECT", targetId: "project-1" }),
      expect.anything(),
    );
  });
});

describe("revokeProjectAccess", () => {
  beforeEach(() => vi.resetAllMocks());

  it("deletes the grant and records an audit event", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "project-1", companyId: "company-1", name: "Hospital Norte" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(txWithProjectMembership()));

    await expect(revokeProjectAccess({ actorUserId: "user-1", projectId: "project-1", userId: "user-2" })).resolves.toEqual({ ok: true });

    expect(mocks.projectMembershipDeleteMany).toHaveBeenCalledWith({
      where: { projectId: "project-1", companyId: "company-1", userId: "user-2" },
    });
    expect(mocks.recordWorkspaceAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PROJECT_UNSHARED", targetType: "PROJECT" }),
      expect.anything(),
    );
  });
});

describe("listProjectAccess", () => {
  beforeEach(() => vi.resetAllMocks());

  it("lists shares scoped to the project and company", async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: "project-1", companyId: "company-1", name: "Hospital Norte" });
    mocks.projectMembershipFindMany.mockResolvedValue([{ id: "pm-1", userId: "user-2", role: "VIEWER" }]);

    await expect(listProjectAccess({ actorUserId: "user-1", projectId: "project-1" })).resolves.toEqual([
      { id: "pm-1", userId: "user-2", role: "VIEWER" },
    ]);

    expect(mocks.projectMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: "project-1", companyId: "company-1" } }),
    );
  });
});
