import type { ResourceCategory } from "@/types/resource";
import type {
  PolynomialFormulaRecord,
  PolynomialFormulaStatus,
} from "@/types/polynomial-formula";
import type {
  CalculatedGeneralExpenseStructureRecord,
  GeneralExpenseGroupKind,
  GeneralExpenseItemCategory,
} from "@/lib/general-expenses/types";
import type { CalculatedBudgetFooterStructureRecord } from "@/lib/budget-footer/types";

export type GeneralExpenseType = "PERCENTAGE" | "FIXED";

export type GeneralExpenseRecord = {
  id: string;
  budgetId: string;
  name: string;
  type: GeneralExpenseType;
  amount?: number | null;
  percentage?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GeneralExpenseInput = {
  name: string;
  type: GeneralExpenseType;
  amount?: number | null;
  percentage?: number | null;
};

export type GeneralExpenseStructure = CalculatedGeneralExpenseStructureRecord;
export type GeneralExpenseSectionGroupKind = GeneralExpenseGroupKind;
export type GeneralExpenseSectionItemCategory = GeneralExpenseItemCategory;

export type GeneralExpenseTitleInput = {
  code?: string;
  name: string;
  category: GeneralExpenseItemCategory;
};

export type GeneralExpenseItemInput = {
  code?: string;
  description: string;
  unit: string;
  quantityDescription?: string | null;
  quantity: number;
  participationPercentage: number;
  unitPrice: number;
};

export type GeneralBudgetResourceSummary = {
  resourceId: string;
  code: string;
  description: string;
  unit: string;
  category: ResourceCategory;
  unitPrice: number;
  totalQuantity: number;
  totalCost: number;
  usageCount: number;
  budgetNames: string[];
};

export type GeneralBudgetResourceSummaryResult = {
  resources: GeneralBudgetResourceSummary[];
  unresolvedCount: number;
  budgetCount: number;
};

export type BudgetFooterDraft = {
  title: string;
  sections: Array<{
    title: string;
    detail: string;
  }>;
};

export type BudgetFooterStructure = CalculatedBudgetFooterStructureRecord;

export type BudgetFooterRowInput = {
  id: string;
  variable: string;
  description: string;
  formula?: string | null;
  manualValue: number;
  iu?: string | null;
  highlight: boolean;
  sortOrder: number;
};

export type PolynomialFormulaSectionSummary = {
  hasFormula: boolean;
  monomialCount: number;
  totalBaseAmount: string;
  status: PolynomialFormulaStatus | "NOT_CREATED";
};

export type PolynomialFormulaSectionPreview = {
  symbol: string;
  label: string;
  detail: string;
};

export type PolynomialFormulaSectionData = {
  title: string;
  coefficients: PolynomialFormulaSectionPreview[];
  notes: string[];
  budgetId?: string;
  formula: PolynomialFormulaRecord | null;
  summary: PolynomialFormulaSectionSummary;
};
