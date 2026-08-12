import { AppShell } from "@/components/layout/app-shell";
import { BudgetDetailLoading } from "@/components/loading/budget-detail-loading";

export default async function BudgetDetailLoadingPage() {
  return (
    <AppShell>
      <BudgetDetailLoading />
    </AppShell>
  );
}
