import type { ResourceCategory } from "@/types/resource";
import type { GeneralBudgetResourceSummaryResult } from "@/types/budget-sections";

type AggregationBudget = {
  name: string;
  items: Array<{
    apu?: {
      resources: Array<{
        resourceId?: string | null;
        quantity: number;
        subtotal: number;
        unitPrice: number;
        resource?: {
          id: string;
          code: string;
          description: string;
          unit: string;
          category: ResourceCategory;
        } | null;
      }>;
    } | null;
  }>;
};

export function aggregateGeneralBudgetResources(budgets: AggregationBudget[]): GeneralBudgetResourceSummaryResult {
  const resourceMap = new Map<
    string,
    {
      resourceId: string;
      code: string;
      description: string;
      unit: string;
      category: ResourceCategory;
      unitPrice: number;
      totalQuantity: number;
      totalCost: number;
      usageCount: number;
      budgetNames: Set<string>;
    }
  >();
  let unresolvedCount = 0;

  for (const budget of budgets) {
    for (const item of budget.items) {
      for (const resource of item.apu?.resources ?? []) {
        if (!resource.resourceId || !resource.resource) {
          unresolvedCount += 1;
          continue;
        }

        const existing = resourceMap.get(resource.resource.id) ?? {
          resourceId: resource.resource.id,
          code: resource.resource.code,
          description: resource.resource.description,
          unit: resource.resource.unit,
          category: resource.resource.category,
          unitPrice: resource.unitPrice,
          totalQuantity: 0,
          totalCost: 0,
          usageCount: 0,
          budgetNames: new Set<string>(),
        };

        existing.totalQuantity = round(existing.totalQuantity + resource.quantity);
        existing.totalCost = round(existing.totalCost + resource.subtotal);
        existing.usageCount += 1;
        existing.unitPrice = resource.unitPrice;
        existing.budgetNames.add(budget.name);
        resourceMap.set(resource.resource.id, existing);
      }
    }
  }

  const resources = [...resourceMap.values()]
    .map((resource) => ({
      resourceId: resource.resourceId,
      code: resource.code,
      description: resource.description,
      unit: resource.unit,
      category: resource.category,
      unitPrice: resource.unitPrice,
      totalQuantity: resource.totalQuantity,
      totalCost: resource.totalCost,
      usageCount: resource.usageCount,
      budgetNames: [...resource.budgetNames].sort(),
    }))
    .sort((left, right) => {
      const categoryCompare = left.category.localeCompare(right.category);
      if (categoryCompare !== 0) return categoryCompare;
      return left.description.localeCompare(right.description);
    });

  return {
    resources,
    unresolvedCount,
    budgetCount: budgets.length,
  };
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
