import { GeneralExpensesManager } from "@/components/budget/general-expenses-manager";
import { GeneralBudgetSectionShell } from "@/components/budget/general-budget-section-shell";
import { getBudgetGeneralExpenses } from "@/lib/data/budgets";
import { getGeneralBudgetSectionContext } from "@/app/budgets/[id]/section-context";

export default async function GeneralBudgetExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { budget, project, session } = await getGeneralBudgetSectionContext(id);
  const expenses = await getBudgetGeneralExpenses(id, session.user.id);

  return (
    <GeneralBudgetSectionShell
      budgetId={budget.id}
      projectId={project.id}
      budgetName={budget.name}
      projectName={project.name}
      activeSection="general-expenses"
      title="Gastos generales"
      description="Desglose operativo persistente del presupuesto general, separado del calculo oficial por tasa."
    >
      <GeneralExpensesManager
        budgetId={budget.id}
        currency={budget.currency}
        totalDirectCost={budget.totalDirectCost}
        generalExpensesRate={budget.generalExpensesRate}
        initialStructure={expenses}
      />
    </GeneralBudgetSectionShell>
  );
}
