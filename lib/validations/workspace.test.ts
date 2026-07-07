import { describe, expect, it } from "vitest";
import {
  workspaceMembershipSchema,
  activeWorkspaceSelectionSchema,
  workspaceRoleSchema,
  inviteWorkspaceMemberSchema,
  toggleStatusSchema,
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

  describe("inviteWorkspaceMemberSchema", () => {
    it("accepts a valid email", () => {
      expect(inviteWorkspaceMemberSchema.parse({ email: "user@test.com" })).toEqual({
        email: "user@test.com",
      });
    });

    it("trims whitespace from email", () => {
      expect(inviteWorkspaceMemberSchema.parse({ email: "  user@test.com  " })).toEqual({
        email: "user@test.com",
      });
    });

    it("rejects missing email", () => {
      expect(() => inviteWorkspaceMemberSchema.parse({})).toThrow();
    });

    it("rejects invalid email format", () => {
      expect(() => inviteWorkspaceMemberSchema.parse({ email: "not-an-email" })).toThrow();
    });

    it("rejects empty string email", () => {
      expect(() => inviteWorkspaceMemberSchema.parse({ email: "   " })).toThrow();
    });
  });

  describe("toggleStatusSchema", () => {
    it("accepts suspend without expiry date", () => {
      expect(toggleStatusSchema.parse({ userId: "user-1", status: "SUSPENDED" })).toEqual({
        userId: "user-1",
        status: "SUSPENDED",
      });
    });

    it("accepts suspend with future expiry date", () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      expect(toggleStatusSchema.parse({ userId: "user-1", status: "SUSPENDED", suspendedUntil: future })).toEqual({
        userId: "user-1",
        status: "SUSPENDED",
        suspendedUntil: future,
      });
    });

    it("rejects suspend with past expiry date", () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      expect(() => toggleStatusSchema.parse({ userId: "user-1", status: "SUSPENDED", suspendedUntil: past })).toThrow(
        "La fecha de suspensión debe ser futura",
      );
    });

    it("accepts reactivation (ACTIVE status)", () => {
      expect(toggleStatusSchema.parse({ userId: "user-1", status: "ACTIVE" })).toEqual({
        userId: "user-1",
        status: "ACTIVE",
      });
    });

    it("rejects ACTIVE status with suspendedUntil", () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      expect(() => toggleStatusSchema.parse({ userId: "user-1", status: "ACTIVE", suspendedUntil: future })).toThrow(
        "suspendedUntil solo aplica al suspender",
      );
    });

    it("rejects missing userId", () => {
      expect(() => toggleStatusSchema.parse({ status: "SUSPENDED" })).toThrow();
    });

    it("rejects invalid status", () => {
      expect(() => toggleStatusSchema.parse({ userId: "user-1", status: "INVITED" })).toThrow();
    });

    it("accepts null suspendedUntil with SUSPENDED (indefinite)", () => {
      expect(toggleStatusSchema.parse({ userId: "user-1", status: "SUSPENDED", suspendedUntil: null })).toEqual({
        userId: "user-1",
        status: "SUSPENDED",
        suspendedUntil: null,
      });
    });

    it("rejects empty userId", () => {
      expect(() => toggleStatusSchema.parse({ userId: "", status: "SUSPENDED" })).toThrow();
    });
  });
});
