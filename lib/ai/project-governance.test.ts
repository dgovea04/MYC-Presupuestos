import { describe, expect, it } from "vitest";
import { assertGovernanceContext, orderGovernanceBindings } from "@/lib/ai/project-governance";

describe("project and team governance", () => {
  it("orders project, team, workspace, user and platform bindings deterministically", () => {
    const result = orderGovernanceBindings([
      { scope: "PLATFORM", scopeId: "platform", credentialId: "p", priority: 1 },
      { scope: "WORKSPACE", scopeId: "w1", credentialId: "w", priority: 2 },
      { scope: "TEAM", scopeId: "t1", credentialId: "t", priority: 3 },
      { scope: "PROJECT", scopeId: "p1", credentialId: "j", priority: 4 },
      { scope: "USER", scopeId: "u1", credentialId: "u", priority: 5 },
      { scope: "PROJECT", scopeId: "other", credentialId: "x", priority: 9 },
    ], { workspaceId: "w1", projectId: "p1", teamId: "t1", userId: "u1" });
    expect(result.map((binding) => binding.credentialId)).toEqual(["u", "j", "t", "w", "p"]);
  });

  it("rejects incomplete contexts", () => {
    expect(() => assertGovernanceContext({ workspaceId: "", userId: "u1" })).toThrow();
    expect(() => assertGovernanceContext({ workspaceId: "w1", userId: "u1", projectId: "" })).toThrow();
  });
});
