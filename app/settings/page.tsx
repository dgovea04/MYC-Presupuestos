import { AppShell } from "@/components/layout/app-shell";
import { SettingsPageContent } from "@/components/settings/settings-page-content";
import { getAuthSession } from "@/lib/auth/session";
import { getUserAccount } from "@/lib/data/account";
import { getUserCompanies } from "@/lib/data/projects";
import { getUserSettings } from "@/lib/data/settings";

export default async function SettingsPage() {
  const session = await getAuthSession();
  const [companies, settings, account] = await Promise.all([
    getUserCompanies(session!.user.id),
    getUserSettings(session!.user.id),
    getUserAccount(session!.user.id),
  ]);
  const company = companies[0];

  return (
    <AppShell currentUser={session!.user} settings={settings}>
      <SettingsPageContent company={company} account={account} initialSettings={settings} />
    </AppShell>
  );
}
