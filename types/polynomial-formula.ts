export type PolynomialCostGroupKey =
  | "LABOR"
  | "MATERIALS"
  | "EQUIPMENT"
  | "OTHERS"
  | "GENERAL_EXPENSES_PROFIT"
  | "STEEL"
  | "CEMENT"
  | "MASONRY"
  | "INSTALLATIONS";

export type PolynomialFormulaStatus = "DRAFT" | "VALID" | "ARCHIVED";

export type BudgetCostGroupRecord = {
  key: PolynomialCostGroupKey;
  amount: string;
  label?: string;
};

export type PolynomialMonomialCompositionRecord = {
  id: string;
  monomialId?: string;
  budgetItemId?: string;
  apuResourceId?: string;
  resourceType?: string;
  amount: string;
  unifiedIndexCode?: string;
  unifiedIndexName?: string;
  iuFamily?: string;
  participationPercentage?: string;
  coefficientContribution?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PolynomialMonomialRecord = {
  id: string;
  formulaId?: string;
  code: string;
  name: string;
  costGroupKey: PolynomialCostGroupKey;
  amount: string;
  coefficient: string;
  baseIndexCode: string;
  baseIndexName: string;
  baseIndexValue: string;
  adjustmentIndexCode?: string | null;
  adjustmentIndexName?: string | null;
  adjustmentIndexValue?: string | null;
  sortOrder: number;
  composition: PolynomialMonomialCompositionRecord[];
  createdAt?: string;
  updatedAt?: string;
};

export type PolynomialMonomialInput = Omit<
  PolynomialMonomialRecord,
  "formulaId" | "createdAt" | "updatedAt"
>;

export type PolynomialFormulaRecord = {
  id: string;
  budgetId: string;
  name: string;
  baseMonth: number;
  baseYear: number;
  totalBaseAmount: string;
  status: PolynomialFormulaStatus;
  monomials: PolynomialMonomialRecord[];
  createdAt?: string;
  updatedAt?: string;
};

export type UnifiedIndexRecord = {
  id: string;
  code: string;
  name: string;
  geographicArea?: string;
  month: number;
  year: number;
  value: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ValuationRecord = {
  id: string;
  formulaId?: string;
  month: number;
  year: number;
  amount: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdjustmentCalculationTermRecord = {
  id: string;
  adjustmentId?: string;
  monomialId?: string | null;
  name: string;
  coefficient: string;
  baseIndexValue: string;
  adjustmentIndexValue: string;
  ratio: string;
  partial: string;
  sortOrder: number;
};

export type AdjustmentCalculationRecord = {
  id: string;
  formulaId: string;
  valuationId?: string | null;
  month: number;
  year: number;
  originalAmount: string;
  adjustedAmount: string;
  adjustmentAmount: string;
  kRaw: string;
  kRounded: string;
  terms: AdjustmentCalculationTermRecord[];
  createdAt?: string;
  updatedAt?: string;
};

export type PolynomialFormulaValidationResult = {
  isValid: boolean;
  coefficientSum: string;
  isCoefficientSumValid: boolean;
  hasMaximumTermsValid: boolean;
  minimumCoefficientWarnings: string[];
  missingBaseIndexWarnings: string[];
  missingAdjustmentIndexWarnings: string[];
};
