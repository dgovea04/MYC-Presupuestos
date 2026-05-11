export type BudgetFooterRowRecord = {
  id: string;
  budgetId?: string;
  variable: string;
  description: string;
  formula: string | null;
  manualValue: number;
  iu: string | null;
  highlight: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CalculatedBudgetFooterRowRecord = BudgetFooterRowRecord & {
  value: number;
  error: string | null;
  isCalculated: boolean;
};

export type BudgetFooterStructureRecord = {
  rows: BudgetFooterRowRecord[];
};

export type CalculatedBudgetFooterStructureRecord = {
  rows: CalculatedBudgetFooterRowRecord[];
  amountInWords: string;
};
