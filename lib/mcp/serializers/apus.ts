import { decimalToString } from "@/lib/db/serializers";

export type McpSerializedBudgetItems = {
  budgets: Array<{
    budgetId: string;
    budgetName: string;
    levels: Array<{
      id: string;
      parentId: string | null;
      type: string;
      code: string;
      name: string;
      sortOrder: number;
    }>;
    items: Array<{
      id: string;
      levelId: string | null;
      code: string;
      description: string;
      unit: string;
      quantity: string;
      unitPrice: string;
      partial: string;
      sortOrder: number;
    }>;
  }>;
};

export function serializeBudgetItems(budgets: Array<{
  id: string;
  name: string;
  levels: Array<{
    id: string;
    parentId: string | null;
    type: string;
    code: string;
    name: string;
    sortOrder: number;
  }>;
  items: Array<{
    id: string;
    levelId: string | null;
    code: string;
    description: string;
    unit: string;
    quantity: string | number;
    unitPrice: string | number;
    partial: string | number;
    sortOrder: number;
  }>;
}>): McpSerializedBudgetItems {
  return {
    budgets: budgets.map((budget) => ({
      budgetId: budget.id,
      budgetName: budget.name,
      levels: budget.levels.map((level) => ({
        id: level.id,
        parentId: level.parentId,
        type: level.type,
        code: level.code,
        name: level.name,
        sortOrder: level.sortOrder,
      })),
      items: budget.items.map((item) => ({
        id: item.id,
        levelId: item.levelId,
        code: item.code,
        description: item.description,
        unit: item.unit,
        quantity: decimalToString(item.quantity),
        unitPrice: decimalToString(item.unitPrice),
        partial: decimalToString(item.partial),
        sortOrder: item.sortOrder,
      })),
    })),
  };
}
