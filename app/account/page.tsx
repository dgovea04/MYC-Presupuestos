import { redirect } from "next/navigation";
import { AccountPageContent } from "@/components/account/account-page-content";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthSession } from "@/lib/auth/session";
import { getUserAccount, getUserAccountMembership } from "@/lib/data/account";
import { getUserSettings } from "@/lib/data/settings";

export default async function AccountPage() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [account, membership, settings] = await Promise.all([
    getUserAccount(session.user.id),
    getUserAccountMembership(session.user.id),
    getUserSettings(session.user.id),
  ]);

  return (
    <AppShell
      currentUser={{
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
