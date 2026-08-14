import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAdminSession() {
  const session = await getAuthSession();

  if (!session || !session.user.id || session.user.role !== "ADMIN" || session.user.status === "SUSPENDED") {
    return null;
  }

  return session;
}

export async function requireSuperAdminSession() {
  const session = await requireAdminSession();

  if (!session?.user.isSuperAdmin) {
    return null;
  }

  return session;
}
