import { describe, expect, it } from "vitest";
import {
  workspaceMembershipSchema,
  activeWorkspaceSelectionSchema,
  workspaceRoleSchema,
} from "@/lib/validations/workspace";

describe("workspace validation", () => {
  it("accepts owner membership payloads", () => {
    expect(
      workspaceMembershipSchema.parse({
        companyId: "company-1",
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
      }),
    ).toMatchObject({ role: "OWNER", status: "ACTIVE" });
  });

  it("rejects unknown roles", () => {
    expect(() => workspaceRoleSchema.parse("GUEST")).toThrow();
  });

  it("accepts active workspace selection", () => {
    expect(activeWorkspaceSelectionSchema.parse({ companyId: "company-1" })).toEqual({
      companyId: "company-1",
    });
  });

  it("rejects empty companyId in workspace selection", () => {
    expect(() => activeWorkspaceSelectionSchema.parse({ companyId: "" })).toThrow();
  });

  it("defaults status to ACTIVE in membership schema", () => {
    const result = workspaceMembershipSchema.parse({
      companyId: "company-1",
      userId: "user-1",
      role: "EDITOR",
    });
    expect(result.status).toBe("ACTIVE");
  });

  it("accepts all valid roles", () => {
    for (const role of ["OWNER", "ADMIN", "EDITOR", "VIEWER"]) {
      expect(() => workspaceRoleSchema.parse(role)).not.toThrow();
    }
  });
});
