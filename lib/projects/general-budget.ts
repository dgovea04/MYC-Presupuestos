type ProjectBudgetLike = {
  id: string;
  kind: "GENERAL" | "SUB_BUDGET";
  parentBudgetId: string | null;
  name?: string;
};

export function resolveProjectGeneralBudget<TBudget extends ProjectBudgetLike>(
  budgets: readonly TBudget[],
): TBudget | null {
  return (
    budgets.find((budget) => budget.kind === "GENERAL" && budget.name === "Presupuesto General") ??
    budgets.find((budget) => budget.kind === "GENERAL") ??
    budgets.find((budget) => budget.parentBudgetId == null) ??
    null
  );
}
