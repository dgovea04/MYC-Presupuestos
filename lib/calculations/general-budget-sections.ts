import Decimal from "decimal.js";
import type { ResourceCategory } from "@/types/resource";
import type { GeneralBudgetResourceSummaryResult } from "@/types/budget-sections";

const RESOURCE_CATEGORY_ORDER: ResourceCategory[] = [
  "LABOR",
  "MATERIAL",
  "EQUIPMENT",
  "TOOLS",
  "SUBCONTRACT",
];

type AggregationBudget = {
  name: string;
  items: Array<{
    quantity: number;
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

        const quantityForItem = new Decimal(item.quantity);
        const resourceSubtotal = getResourceSubtotal(resource.quantity, resource.unitPrice, resource.resource.unit, resource.subtotal);
        existing.totalQuantity = round(new Decimal(existing.totalQuantity).plus(new Decimal(resource.quantity).times(quantityForItem)));
        existing.totalCost = round(new Decimal(existing.totalCost).plus(resourceSubtotal.times(quantityForItem)));
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
      const categoryCompare = RESOURCE_CATEGORY_ORDER.indexOf(left.category) - RESOURCE_CATEGORY_ORDER.indexOf(right.category);
      if (categoryCompare !== 0) return categoryCompare;
      return left.description.localeCompare(right.description);
    });

  return {
    resources,
    unresolvedCount,
    budgetCount: budgets.length,
  };
}

function getResourceSubtotal(quantity: number, unitPrice: number, unit: string, persistedSubtotal: number) {
  if (unit.trim().startsWith("%")) {
    return new Decimal(persistedSubtotal);
  }

  return new Decimal(quantity).times(unitPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function round(value: Decimal.Value) {
  return Number(new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString());
}
