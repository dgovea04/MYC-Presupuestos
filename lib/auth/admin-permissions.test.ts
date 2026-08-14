import { describe, expect, it } from "vitest";
import { hasAdminCapability, requiresAdminMfa } from "@/lib/auth/admin-permissions";

describe("admin capabilities", () => {
  it("allows operational capabilities to active administrators", () => {
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE" }, "users.manage_access")).toBe(true);
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE" }, "audit.read")).toBe(true);
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE" }, "users.revoke_sessions")).toBe(true);
  });

  it("maps support, billing, and audit profiles to limited capabilities", () => {
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE", adminProfile: "SUPPORT" }, "users.manage_lifecycle")).toBe(true);
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE", adminProfile: "SUPPORT" }, "users.revoke_sessions")).toBe(true);
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE", adminProfile: "SUPPORT" }, "billing.manage")).toBe(false);
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE", adminProfile: "BILLING_ADMIN" }, "billing.manage")).toBe(true);
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE", adminProfile: "AUDITOR" }, "audit.read")).toBe(true);
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE", adminProfile: "AUDITOR" }, "users.manage_access")).toBe(false);
  });

  it("keeps critical capabilities for the primary administrator", () => {
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE" }, "users.delete_permanently")).toBe(false);
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE", isSuperAdmin: true }, "users.delete_permanently")).toBe(true);
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE", isSuperAdmin: true }, "system_settings.manage")).toBe(true);
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE", isSuperAdmin: true }, "audit.manage_retention")).toBe(true);
    expect(hasAdminCapability({ role: "ADMIN", status: "ACTIVE" }, "audit.manage_retention")).toBe(false);
  });

  it("requires MFA for retention changes", () => {
    expect(requiresAdminMfa("audit.manage_retention")).toBe(true);
  });

  it("rejects users and suspended administrators", () => {
    expect(hasAdminCapability({ role: "USER", status: "ACTIVE" }, "users.read")).toBe(false);
    expect(hasAdminCapability({ role: "ADMIN", status: "SUSPENDED", isSuperAdmin: true }, "audit.read")).toBe(false);
  });
});
