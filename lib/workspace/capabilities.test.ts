import { describe, expect, it } from "vitest";
import {
  BASE_ROLE_CAPABILITIES,
  CUSTOMIZABLE_CAPABILITIES,
  OWNER_ONLY_CAPABILITIES,
  WORKSPACE_CAPABILITIES,
  isWorkspaceCapability,
} from "@/lib/workspace/capabilities";

describe("workspace capability matrix", () => {
  it("gives OWNER every capability", () => {
    expect(BASE_ROLE_CAPABILITIES.OWNER.size).toBe(WORKSPACE_CAPABILITIES.length);
  });

  it("excludes owner-only destructive actions from ADMIN", () => {
    expect(BASE_ROLE_CAPABILITIES.ADMIN.has("workspace.delete")).toBe(false);
    expect(BASE_ROLE_CAPABILITIES.ADMIN.has("workspace.transfer")).toBe(false);
    expect(BASE_ROLE_CAPABILITIES.ADMIN.has("budgets.create")).toBe(true);
  });

  it("keeps VIEWER read-only", () => {
    expect(BASE_ROLE_CAPABILITIES.VIEWER.has("budgets.read")).toBe(true);
    expect(BASE_ROLE_CAPABILITIES.VIEWER.has("budgets.create")).toBe(false);
    expect(BASE_ROLE_CAPABILITIES.VIEWER.has("members.manage")).toBe(false);
  });

  it("grants EDITOR full catalog mutations but keeps VIEWER read-only on insumos", () => {
    expect(BASE_ROLE_CAPABILITIES.EDITOR.has("resources.read")).toBe(true);
    expect(BASE_ROLE_CAPABILITIES.EDITOR.has("resources.create")).toBe(true);
    expect(BASE_ROLE_CAPABILITIES.EDITOR.has("resources.update")).toBe(true);
    expect(BASE_ROLE_CAPABILITIES.EDITOR.has("resources.delete")).toBe(true);
    expect(BASE_ROLE_CAPABILITIES.VIEWER.has("resources.read")).toBe(true);
    expect(BASE_ROLE_CAPABILITIES.VIEWER.has("resources.create")).toBe(false);
    expect(BASE_ROLE_CAPABILITIES.VIEWER.has("resources.delete")).toBe(false);
  });

  it("limits customizable capabilities to ADMIN level (no owner-only)", () => {
    expect(CUSTOMIZABLE_CAPABILITIES.has("workspace.delete")).toBe(false);
    expect(CUSTOMIZABLE_CAPABILITIES.has("workspace.transfer")).toBe(false);
    expect(CUSTOMIZABLE_CAPABILITIES.has("budgets.create")).toBe(true);
    expect([...OWNER_ONLY_CAPABILITIES]).toEqual(["workspace.delete", "workspace.transfer"]);
  });

  it("validates known capabilities", () => {
    expect(isWorkspaceCapability("budgets.create")).toBe(true);
    expect(isWorkspaceCapability("not.a.capability")).toBe(false);
  });
});
