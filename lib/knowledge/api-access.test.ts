import { describe, expect, it, vi } from "vitest";
import { assertKnowledgeApiScopeAccess } from "./api-access";

const { assertWorkspaceMembership, assertProjectInWorkspace } = vi.hoisted(() => ({ assertWorkspaceMembership: vi.fn().mockResolvedValue({ companyId: "c1", role: "EDITOR" }), assertProjectInWorkspace: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership, assertProjectInWorkspace }));

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
});
