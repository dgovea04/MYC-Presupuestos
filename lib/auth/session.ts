import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasAdminCapability, requiresAdminMfa, type AdminCapability } from "@/lib/auth/admin-permissions";
import { getAdminMfaProofFromRequest, isValidAdminMfaProof } from "@/lib/auth/admin-mfa";

export function getBaseAuthSession() {
  return getServerSession(authOptions);
}

export function getAuthSession() {
  return getBaseAuthSession();
}

export async function requireAdminSession(capability?: AdminCapability, request?: Request) {
  const session = await getAuthSession();
  const resolvedCapability = capability ?? "users.read";

  if (!session || !session.user.id || !hasAdminCapability(session.user, resolvedCapability)) {
    return null;
  }

  if (
    requiresAdminMfa(resolvedCapability) &&
    (!session.user.mfaEnabled || !request || !isValidAdminMfaProof(getAdminMfaProofFromRequest(request), session.user.id))
  ) {
    return null;
  }

  return session;
}

export async function requireSuperAdminSession(request?: Request) {
  return requireAdminSession("users.reset_password", request);
}
