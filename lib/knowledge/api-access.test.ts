import { describe, expect, it, vi } from "vitest";
import { assertKnowledgeApiScopeAccess, assertKnowledgeEntityAccess } from "./api-access";

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
