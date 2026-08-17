export type AdminCapability =
  | "users.read"
  | "users.manage_access"
  | "users.manage_lifecycle"
  | "users.revoke_sessions"
  | "users.impersonate"
  | "users.verify_email"
  | "users.change_role"
  | "users.reset_password"
  | "users.delete_permanently"
  | "users.approve_deletion"
  | "billing.manage"
  | "beta.read"
  | "beta.manage"
  | "beta.assign"
  | "beta.revoke"
  | "beta.export"
  | "system_settings.read"
  | "system_settings.manage"
  | "audit.read"
  | "audit.manage_retention"
  | "security.manage"
  | "resource_prices.manage";

export type AdminProfile = "SUPER_ADMIN" | "ADMIN" | "SUPPORT" | "BILLING_ADMIN" | "AUDITOR";

export type AdminPrincipal = {
  role?: "ADMIN" | "USER";
  adminProfile?: AdminProfile | null;
  status?: "ACTIVE" | "SUSPENDED";
  isSuperAdmin?: boolean;
};

const administratorCapabilities = new Set<AdminCapability>([
  "users.read",
  "users.manage_access",
  "users.manage_lifecycle",
  "users.revoke_sessions",
  "users.impersonate",
  "users.verify_email",
  "users.approve_deletion",
  "billing.manage",
  "beta.read",
  "beta.manage",
  "beta.assign",
  "beta.revoke",
  "beta.export",
  "system_settings.read",
  "audit.read",
  "resource_prices.manage",
]);

const profileCapabilities: Record<Exclude<AdminProfile, "SUPER_ADMIN">, ReadonlySet<AdminCapability>> = {
  ADMIN: administratorCapabilities,
  SUPPORT: new Set(["users.read", "users.manage_lifecycle", "users.revoke_sessions", "users.impersonate", "users.verify_email", "audit.read"]),
  BILLING_ADMIN: new Set(["users.read", "billing.manage", "beta.read", "beta.manage", "beta.assign", "beta.revoke", "beta.export", "audit.read"]),
  AUDITOR: new Set(["users.read", "beta.read", "beta.export", "audit.read"]),
};

const mfaProtectedCapabilities = new Set<AdminCapability>([
  "users.reset_password",
  "users.delete_permanently",
  "users.change_role",
  "system_settings.manage",
  "audit.manage_retention",
]);

export function requiresAdminMfa(capability: AdminCapability) {
  return mfaProtectedCapabilities.has(capability);
}

export function hasAdminCapability(principal: AdminPrincipal | null | undefined, capability: AdminCapability) {
  if (!principal || principal.role !== "ADMIN" || principal.status === "SUSPENDED") {
    return false;
  }

  if (principal.isSuperAdmin || principal.adminProfile === "SUPER_ADMIN") {
    return true;
  }

  if (principal.adminProfile) {
    return profileCapabilities[principal.adminProfile].has(capability);
  }

  return administratorCapabilities.has(capability);
}
