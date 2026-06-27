import { BudgetEditorSkeleton } from "@/components/budget/budget-editor-skeleton";
import { AppShell } from "@/components/layout/app-shell";

export default async function BudgetDetailLoading() {
  return (
    <AppShell>
      <BudgetEditorSkeleton />
    </AppShell>
  );
}
