import { AppShell } from "@/components/layout/app-shell";
import { SettingsPageContent } from "@/components/settings/settings-page-content";
import { getAuthSession } from "@/lib/auth/session";
import { getUserAccount } from "@/lib/data/account";
import { getUserCompanies } from "@/lib/data/projects";
import { getWorkCalendars } from "@/lib/data/work-calendars";
import { getUserSettings } from "@/lib/data/settings";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getEffectiveWorkspaceLicense, hasFeatureAccess } from "@/lib/workspace/entitlements";

export default async function SettingsPage() {
  const session = await getAuthSession();
  const activeWorkspaceId = await getActiveWorkspaceId(session!.user.id);
  const [companies, settings, account, workCalendars, license] = await Promise.all([
    getUserCompanies(session!.user.id),
    getUserSettings(session!.user.id),
    getUserAccount(session!.user.id),
    getWorkCalendars(),
    getEffectiveWorkspaceLicense({ userId: session!.user.id, companyId: activeWorkspaceId }),
  ]);
  const company = companies[0];
  const canUseKhipu = hasFeatureAccess(license, "khipu.agent");

  return (
    <AppShell currentUser={session!.user} settings={settings}>
      <SettingsPageContent
        company={company}
        account={account}
        initialSettings={settings}
        initialWorkCalendars={workCalendars}
        canUseKhipu={canUseKhipu}
      />
    </AppShell>
  );
}
