import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAdminSession() {
  const session = await getAuthSession();

  if (!session || session.user.role !== "ADMIN" || session.user.status === "SUSPENDED") {
    return null;
  }

  return session;
}
