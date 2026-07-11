import { decimalToString } from "@/lib/db/serializers";
import type { Prisma } from "@prisma/client";

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

export type McpSerializedProjectResources = {
  resources: Array<{
    id: string;
    code: string;
    description: string;
    category: string;
    unit: string;
    currency: string;
    unitPrice: string;
    iu: string | null;
    iuCurrent: string | null;
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

export function serializeProjectResources(resources: Array<{
  id: string;
  code: string;
  description: string;
  category: string;
  unit: string;
  currency: string;
  unitPrice: Prisma.Decimal | string | number;
  iu: string | null;
  iuCurrent: string | null;
}>): McpSerializedProjectResources {
  return {
    resources: resources.map((resource) => ({
      id: resource.id,
      code: resource.code,
      description: resource.description,
      category: resource.category,
      unit: resource.unit,
      currency: resource.currency,
      unitPrice: decimalToString(resource.unitPrice),
      iu: resource.iu,
      iuCurrent: resource.iuCurrent,
    })),
  };
}
