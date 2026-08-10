import { AppShell } from "@/components/layout/app-shell";
import { BudgetEditorPageSkeleton } from "@/components/loading/budget-editor-page-skeleton";

export default async function BudgetDetailLoading() {
  return (
    <AppShell>
      <BudgetEditorPageSkeleton />
    </AppShell>
  );
}
