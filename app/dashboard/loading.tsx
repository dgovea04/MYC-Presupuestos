import { AppShell } from "@/components/layout/app-shell";
import { DashboardPageSkeleton } from "@/components/loading/dashboard-page-skeleton";

export default async function DashboardLoading() {
  return (
    <AppShell>
      <DashboardPageSkeleton />
    </AppShell>
  );
}
