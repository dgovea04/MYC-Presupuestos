import { GeneralBudgetResourcesTable } from "@/components/budget/general-budget-resources-table";
import { GeneralBudgetSectionShell } from "@/components/budget/general-budget-section-shell";
import { getGeneralBudgetResourceSummary } from "@/lib/data/budgets";
import { getGeneralBudgetSectionContext } from "@/app/budgets/[id]/section-context";

export default async function GeneralBudgetResourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { budget, project, session } = await getGeneralBudgetSectionContext(id);
  const summary = await getGeneralBudgetResourceSummary(id, session.user.id);

  return (
    <GeneralBudgetSectionShell
      budgetId={budget.id}
      projectId={project.id}
      budgetName={budget.name}
      projectName={project.name}
      activeSection="resources"
      title="Lista de insumos"
      description="Consolidado derivado desde los APUs de los Sub Presupuestos del proyecto."
    >
      <GeneralBudgetResourcesTable summary={summary} currency={budget.currency} />
    </GeneralBudgetSectionShell>
  );
}
