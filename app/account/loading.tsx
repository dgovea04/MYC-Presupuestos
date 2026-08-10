import { AppShell } from "@/components/layout/app-shell";
import { SettingsPageSkeleton } from "@/components/loading/settings-page-skeleton";

export default async function AccountLoading() {
  return (
    <AppShell>
      <SettingsPageSkeleton kind="account" />
    </AppShell>
  );
}
