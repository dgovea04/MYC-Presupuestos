import type { PolynomialCostGroupKey } from "@/types/polynomial-formula";

export type DecimalString = string;

export type DirectCostBreakdownInput = {
  labor: DecimalString;
  materials: DecimalString;
  equipment: DecimalString;
  others: DecimalString;
};

export type BudgetCostGroupCalculationInput = {
  directCostBreakdown: DirectCostBreakdownInput;
  generalExpenses: DecimalString;
  utility: DecimalString;
};

export type BudgetCostGroupCalculationResult = {
  groups: Array<{
    key: PolynomialCostGroupKey;
    amount: DecimalString;
  }>;
  totalBaseAmount: DecimalString;
};

export type MonomialCoefficientCalculationInput = {
  key: PolynomialCostGroupKey;
  amount: DecimalString;
};

export type PolynomialValidationMonomialInput = {
  coefficient: DecimalString;
  baseIndexValue: DecimalString | null;
  adjustmentIndexValue?: DecimalString | null;
  name?: string;
};

export type CoefficientKCalculationInput = {
  coefficient: DecimalString;
  baseIndexValue: DecimalString;
  adjustmentIndexValue: DecimalString;
  name: string;
};

export type CoefficientKCalculationTerm = CoefficientKCalculationInput & {
  ratio: DecimalString;
  partial: DecimalString;
};

export type CoefficientKCalculationResult = {
  terms: CoefficientKCalculationTerm[];
  kRaw: DecimalString;
  kRounded: DecimalString;
};

export type AdjustmentAmountCalculationInput = {
  originalAmount: DecimalString;
  kRounded: DecimalString;
};

export type AdjustmentAmountCalculationResult = {
  originalAmount: DecimalString;
  adjustedAmount: DecimalString;
  adjustmentAmount: DecimalString;
  kRounded: DecimalString;
};
