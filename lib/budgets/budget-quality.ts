import type { BudgetItemRecord } from "@/types/budget";

export type BudgetItemQualityState = {
  requiresCatalogReview: boolean;
  resolvedFromSuggestion: boolean;
};

export type BudgetQualitySummary = {
  itemsWithoutUsefulUnitPrice: number;
  itemsWithZeroUnitPrice: number;
  itemsWithoutApu: number;
  itemsRequiringCatalogReview: number;
  itemsResolvedFromSuggestion: number;
};

export function calculateBudgetQualitySummary(
  items: BudgetItemRecord[],
  itemQualityStateById: Record<string, BudgetItemQualityState | undefined>,
): BudgetQualitySummary {
  return items.reduce<BudgetQualitySummary>(
    (summary, item) => {
      const state = itemQualityStateById[item.id];
      const hasUsefulUnitPrice = item.unitPrice > 0;
      const requiresCatalogReview = state?.requiresCatalogReview ?? !item.apu;

      if (!hasUsefulUnitPrice) {
        summary.itemsWithoutUsefulUnitPrice += 1;
      }

      if (item.unitPrice <= 0) {
        summary.itemsWithZeroUnitPrice += 1;
      }

      if (!item.apu) {
        summary.itemsWithoutApu += 1;
      }

      if (requiresCatalogReview) {
        summary.itemsRequiringCatalogReview += 1;
      }

      if (state?.resolvedFromSuggestion) {
        summary.itemsResolvedFromSuggestion += 1;
      }

      return summary;
    },
    {
      itemsWithoutUsefulUnitPrice: 0,
      itemsWithZeroUnitPrice: 0,
      itemsWithoutApu: 0,
      itemsRequiringCatalogReview: 0,
      itemsResolvedFromSuggestion: 0,
    },
  );
}
