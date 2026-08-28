import { redirect } from "next/navigation";
import { AccountPageContent } from "@/components/account/account-page-content";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthSession } from "@/lib/auth/session";
import { getUserAccount, getUserAccountMembership } from "@/lib/data/account";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getUserSettings } from "@/lib/data/settings";
import { unstable_noStore as noStore } from "next/cache";

export default async function AccountPage() {
  noStore();
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
  const [account, membership, settings] = await Promise.all([
    getUserAccount(session.user.id),
    getUserAccountMembership(session.user.id, activeWorkspaceId),
    getUserSettings(session.user.id),
  ]);

  return (
    <AppShell
      currentUser={{
        id: session.user.id,
        avatarUrl: account.avatarUrl,
        email: account.email,
        name: account.name,
        role: session.user.role,
      }}
      settings={settings}
    >
      <AccountPageContent initialAccount={account} membership={membership} />
    </AppShell>
  );
}
