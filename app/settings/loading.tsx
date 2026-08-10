import { AppShell } from "@/components/layout/app-shell";
import { SettingsPageSkeleton } from "@/components/loading/settings-page-skeleton";

export default async function SettingsLoading() {
  return (
    <AppShell>
      <SettingsPageSkeleton />
    </AppShell>
  );
}
