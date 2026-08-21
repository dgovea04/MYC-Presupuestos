import { describe, expect, it } from "vitest";
import { sanitizeWorkspaceRolePermissions } from "@/lib/workspace/roles";

describe("sanitizeWorkspaceRolePermissions", () => {
  it("deduplicates valid permissions", () => {
    expect(sanitizeWorkspaceRolePermissions(["budgets.read", "budgets.read", "budgets.create"])).toEqual(["budgets.read", "budgets.create"]);
  });

  it("rejects invalid permission keys", () => {
    expect(() => sanitizeWorkspaceRolePermissions(["not.a.capability"])).toThrow(/Permiso inválido/);
  });

  it("rejects owner-only escalation", () => {
    expect(() => sanitizeWorkspaceRolePermissions(["workspace.delete"])).toThrow(/restringido/);
    expect(() => sanitizeWorkspaceRolePermissions(["workspace.transfer"])).toThrow(/restringido/);
  });

  it("rejects non-array input", () => {
    expect(() => sanitizeWorkspaceRolePermissions("budgets.read")).toThrow(/Permisos inválidos/);
  });
});
