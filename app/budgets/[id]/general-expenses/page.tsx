import { GeneralExpensesManager } from "@/components/budget/general-expenses-manager";
import { GeneralBudgetSectionShell } from "@/components/budget/general-budget-section-shell";
import { getBudgetGeneralExpenses } from "@/lib/data/budgets";
import { getGeneralBudgetSectionContext } from "@/app/budgets/[id]/section-context";

export default async function GeneralBudgetExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ template?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { budget, currentUser, project, session, settings } = await getGeneralBudgetSectionContext(id);
  const expenses = await getBudgetGeneralExpenses(id, session.user.id);
  const initialTemplateFocus = resolveGeneralExpenseTemplateFocus(resolvedSearchParams.template);

  return (
    <GeneralBudgetSectionShell
      budgetId={budget.id}
      projectId={project.id}
      budgetName={budget.name}
      projectName={project.name}
      activeSection="general-expenses"
      title="Gastos generales"
      description="Desglose operativo persistente del presupuesto general, separado del calculo oficial por tasa."
      currentUser={currentUser}
      settings={settings}
    >
      <GeneralExpensesManager
        budgetId={budget.id}
        currency={budget.currency}
        totalDirectCost={budget.totalDirectCost}
        initialStructure={expenses}
        initialTemplateFocus={initialTemplateFocus}
      />
    </GeneralBudgetSectionShell>
  );
}

function resolveGeneralExpenseTemplateFocus(templateId: string | undefined) {
  if (templateId === "general-expenses-fixed-workbook") return "FIXED";
  if (templateId === "general-expenses-variable-workbook") return "VARIABLE";
  return null;
}
