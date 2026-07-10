import { decimalToString } from "@/lib/db/serializers";

export type McpSerializedBudgetTree = {
  budgets: Array<{
    id: string;
    parentBudgetId: string | null;
    kind: string;
    name: string;
    currency: string;
    igvRate: string;
    generalExpensesRate: string;
    utilityRate: string;
    totalDirectCost: string;
    totalGeneralExpenses: string;
    totalUtility: string;
    totalTax: string;
    totalAmount: string;
  }>;
};

export function serializeBudgetTree(budgets: Array<{
  id: string;
  parentBudgetId: string | null;
  kind: string;
  name: string;
  currency: string;
  igvRate: string | number;
  generalExpensesRate: string | number;
  utilityRate: string | number;
  totalDirectCost: string | number;
  totalGeneralExpenses: string | number;
  totalUtility: string | number;
  totalTax: string | number;
  totalAmount: string | number;
}>): McpSerializedBudgetTree {
  return {
    budgets: budgets.map((budget) => ({
      id: budget.id,
      parentBudgetId: budget.parentBudgetId,
      kind: budget.kind,
      name: budget.name,
      currency: budget.currency,
      igvRate: decimalToString(budget.igvRate),
      generalExpensesRate: decimalToString(budget.generalExpensesRate),
      utilityRate: decimalToString(budget.utilityRate),
      totalDirectCost: decimalToString(budget.totalDirectCost),
      totalGeneralExpenses: decimalToString(budget.totalGeneralExpenses),
      totalUtility: decimalToString(budget.totalUtility),
      totalTax: decimalToString(budget.totalTax),
      totalAmount: decimalToString(budget.totalAmount),
    })),
  };
}
