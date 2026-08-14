import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AdminSupportSessionView } from "@/components/admin/admin-support-session-view";
import { ADMIN_SUPPORT_SESSION_COOKIE_NAME, verifyAdminSupportSession } from "@/lib/auth/admin-support-session";
import { getBaseAuthSession } from "@/lib/auth/session";
import { getAdminSupportTarget } from "@/lib/data/admin-support";

export default async function AdminSupportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getBaseAuthSession();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const token = verifyAdminSupportSession(cookieStore.get(ADMIN_SUPPORT_SESSION_COOKIE_NAME)?.value ?? null, session.user.id);
  const { id } = await params;
  if (!token || token.targetUserId !== id) redirect("/admin");

  const target = await getAdminSupportTarget(token.targetUserId);
  if (!target) redirect("/admin");

  return <AdminSupportSessionView target={target} />;
}
