import { describe, expect, it, vi } from "vitest";
import { resolveWorkspaceCapabilities } from "@/lib/workspace/permissions";

function createClient(membership: unknown) {
  return { companyMembership: { findUnique: vi.fn().mockResolvedValue(membership) } };
}

describe("resolveWorkspaceCapabilities", () => {
  it("falls back to the base role when there is no custom role", async () => {
    const client = createClient({ role: "EDITOR", status: "ACTIVE", customRoleId: null, customRole: null });
    const result = await resolveWorkspaceCapabilities({ userId: "u1", companyId: "c1", client });
    expect(result.role).toBe("EDITOR");
    expect(result.customRoleId).toBeNull();
    expect(result.capabilities.has("budgets.create")).toBe(true);
    expect(result.capabilities.has("members.manage")).toBe(false);
  });

  it("uses the custom role permissions when assigned", async () => {
    const client = createClient({
      role: "VIEWER",
      status: "ACTIVE",
      customRoleId: "role-1",
      customRole: { permissions: [{ permissionKey: "budgets.create" }, { permissionKey: "budgets.read" }] },
    });
    const result = await resolveWorkspaceCapabilities({ userId: "u1", companyId: "c1", client });
    expect(result.customRoleId).toBe("role-1");
    expect(result.capabilities.has("budgets.create")).toBe(true);
    expect(result.capabilities.has("projects.read")).toBe(false);
  });

  it("bounds custom roles to customizable capabilities (no owner-only escalation)", async () => {
    const client = createClient({
      role: "VIEWER",
      status: "ACTIVE",
      customRoleId: "role-1",
      customRole: { permissions: [{ permissionKey: "workspace.delete" }, { permissionKey: "budgets.read" }] },
    });
    const result = await resolveWorkspaceCapabilities({ userId: "u1", companyId: "c1", client });
    expect(result.capabilities.has("workspace.delete")).toBe(false);
    expect(result.capabilities.has("budgets.read")).toBe(true);
  });

  it("returns no capabilities for inactive or missing memberships", async () => {
    const client = createClient(null);
    const result = await resolveWorkspaceCapabilities({ userId: "u1", companyId: "c1", client });
    expect(result.capabilities.size).toBe(0);
  });
});
