import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertKnowledgeApiScopeAccess,
  assertKnowledgeEntityAccess,
  assertKnowledgeReadAccess,
  assertKnowledgeWriteAccess,
} from "./api-access";

const { assertWorkspaceMembership, assertProjectInWorkspace, prismaMock } = vi.hoisted(() => ({
  assertWorkspaceMembership: vi.fn().mockResolvedValue({ companyId: "c1", role: "EDITOR" }),
  assertProjectInWorkspace: vi.fn().mockResolvedValue(undefined),
  prismaMock: {
    knowledgeSource: { findUnique: vi.fn() },
    knowledgeEvidence: { findUnique: vi.fn() },
    canonicalItem: { findUnique: vi.fn() },
    canonicalResource: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership, assertProjectInWorkspace }));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

describe("knowledge API scope access", () => {
  beforeEach(() => {
    assertWorkspaceMembership.mockReset().mockResolvedValue({ companyId: "c1", role: "EDITOR" });
    assertProjectInWorkspace.mockReset().mockResolvedValue(undefined);
    prismaMock.knowledgeSource.findUnique.mockReset();
    prismaMock.knowledgeEvidence.findUnique.mockReset();
    prismaMock.canonicalItem.findUnique.mockReset();
    prismaMock.canonicalResource.findUnique.mockReset();
  });

  it("allows company reads for a VIEWER", async () => {
    assertWorkspaceMembership.mockResolvedValueOnce({ companyId: "c1", role: "VIEWER" });

    await expect(assertKnowledgeReadAccess({
      actorUserId: "u1",
      companyId: "c1",
      scope: "COMPANY",
    })).resolves.toMatchObject({ scope: "COMPANY", companyId: "c1" });
    expect(assertWorkspaceMembership).toHaveBeenCalledWith({ userId: "u1", companyId: "c1", minimumRole: "VIEWER" });
  });

  it("denies a project that belongs to another company before reading knowledge", async () => {
    assertProjectInWorkspace.mockRejectedValueOnce(new Error("El proyecto no pertenece a este workspace"));

    await expect(assertKnowledgeReadAccess({
      actorUserId: "u1",
      companyId: "c1",
      projectId: "project-b",
      scope: "PROJECT",
    })).rejects.toThrow("El proyecto no pertenece a este workspace");
    expect(prismaMock.knowledgeSource.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.knowledgeEvidence.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.canonicalItem.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.canonicalResource.findUnique).not.toHaveBeenCalled();
  });

  it("requires EDITOR membership for writes", async () => {
    assertWorkspaceMembership.mockRejectedValueOnce(new Error("No tienes el rol necesario en este workspace"));

    await expect(assertKnowledgeWriteAccess({
      actorUserId: "u1",
      companyId: "c1",
      scope: "COMPANY",
    })).rejects.toThrow("No tienes el rol necesario");
    expect(assertWorkspaceMembership).toHaveBeenCalledWith({ userId: "u1", companyId: "c1", minimumRole: "EDITOR" });
  });

  it("requires the knowledge management capability for GLOBAL knowledge", async () => {
    prismaMock.canonicalItem.findUnique.mockResolvedValueOnce({ id: "global-item", companyId: null, scope: "GLOBAL" });

    await expect(assertKnowledgeWriteAccess({
      actorUserId: "u1",
      scope: "GLOBAL",
      entityType: "CanonicalItem",
      entityId: "global-item",
    })).rejects.toThrow("Knowledge tenant access denied");

    prismaMock.canonicalItem.findUnique.mockResolvedValueOnce({ id: "global-item", companyId: null, scope: "GLOBAL" });
    await expect(assertKnowledgeWriteAccess({
      actorUserId: "u1",
      scope: "GLOBAL",
      entityType: "CanonicalItem",
      entityId: "global-item",
      capability: "knowledge.manage",
    })).resolves.toMatchObject({ scope: "GLOBAL", companyId: null });
  });

  it("uses the same denial for a missing entity and a cross-company entity", async () => {
    prismaMock.knowledgeSource.findUnique.mockResolvedValueOnce(null);
    const missing = assertKnowledgeWriteAccess({
      actorUserId: "u1",
      companyId: "company-a",
      entityType: "KnowledgeSource",
      entityId: "missing-source",
    });

    prismaMock.knowledgeSource.findUnique.mockResolvedValueOnce({ id: "other-source", companyId: "company-b", projectId: null });
    const foreign = assertKnowledgeWriteAccess({
      actorUserId: "u1",
      companyId: "company-a",
      entityType: "KnowledgeSource",
      entityId: "other-source",
    });

    await expect(missing).rejects.toThrow("Knowledge tenant access denied");
    await expect(foreign).rejects.toThrow("Knowledge tenant access denied");
  });

  it("allows a user scope only for the authenticated user", async () => {
    await expect(assertKnowledgeApiScopeAccess({ actorUserId: "u1", scope: "USER", userId: "u1" })).resolves.toBeUndefined();
    await expect(assertKnowledgeApiScopeAccess({ actorUserId: "u1", scope: "USER", userId: "u2" })).rejects.toThrow("otro usuario");
  });

  it("requires workspace membership for company scope", async () => {
    await assertKnowledgeApiScopeAccess({ actorUserId: "u1", scope: "COMPANY", companyId: "c1" });
    expect(assertWorkspaceMembership).toHaveBeenCalledWith({ userId: "u1", companyId: "c1", minimumRole: "EDITOR" });
  });

  it("requires both membership and project ownership for project scope", async () => {
    await assertKnowledgeApiScopeAccess({ actorUserId: "u1", scope: "PROJECT", companyId: "c1", projectId: "p1" });
    expect(assertProjectInWorkspace).toHaveBeenCalledWith({ companyId: "c1", projectId: "p1" });
  });

  it("rejects a source owned by another company before a knowledge write", async () => {
    prismaMock.knowledgeSource.findUnique.mockResolvedValueOnce({ id: "s1", companyId: "company-b", projectId: "project-b" });

    await expect(assertKnowledgeEntityAccess({
      actorUserId: "u1",
      entityType: "KnowledgeSource",
      entityId: "s1",
      companyId: "company-a",
      projectId: "project-a",
      minimumRole: "EDITOR",
    })).rejects.toThrow("tenant");
  });

  it("rejects an unscoped legacy evidence record instead of allowing cross-tenant attachment", async () => {
    prismaMock.knowledgeEvidence.findUnique.mockResolvedValueOnce({ id: "e1", source: { companyId: null, projectId: null } });

    await expect(assertKnowledgeEntityAccess({
      actorUserId: "u1",
      entityType: "KnowledgeEvidence",
      entityId: "e1",
      companyId: "company-a",
      projectId: "project-a",
      minimumRole: "EDITOR",
    })).rejects.toThrow("tenant");
  });
});
