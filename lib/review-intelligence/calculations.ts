import Decimal from "decimal.js";

export interface QuantityComparison {
  documentValue: Decimal;
  budgetValue: Decimal;
  difference: Decimal;
  percentage: Decimal | null;
  potentialImpact: Decimal | null;
  tolerance: Decimal;
  exceedsTolerance: boolean;
}

export function calculateQuantityDifference(input: {
  documentValue: Decimal;
  budgetValue: Decimal;
  unitPrice?: Decimal;
  tolerance: Decimal;
}): QuantityComparison {
  const difference = input.documentValue.minus(input.budgetValue);
  const onePercent = input.budgetValue.abs().times(new Decimal("0.01"));
  const tolerance = Decimal.max(input.tolerance.abs(), onePercent);
  const percentage = input.budgetValue.isZero()
    ? null
    : difference.abs().dividedBy(input.budgetValue.abs()).times(new Decimal(100));

  return {
    documentValue: input.documentValue,
    budgetValue: input.budgetValue,
    difference,
    percentage,
    potentialImpact: input.unitPrice === undefined ? null : difference.times(input.unitPrice),
    tolerance,
    exceedsTolerance: difference.abs().greaterThan(tolerance),
  };
}
