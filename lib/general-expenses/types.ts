export type GeneralExpenseGroupKind = "FIXED" | "VARIABLE";

export type GeneralExpenseItemCategory = "STANDARD" | "PERSONAL" | "TESTING" | "DIRECT_COST_BASED";

export type GeneralExpenseItemRecord = {
  id: string;
  titleId?: string;
  code: string;
  description: string;
  category: GeneralExpenseItemCategory;
  unit: string;
  quantityDescription: string | null;
  quantity: number;
  participationPercentage: number;
  unitPrice: number;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type GeneralExpenseTitleRecord = {
  id: string;
  groupId?: string;
  code: string;
  name: string;
  category: GeneralExpenseItemCategory;
  sortOrder: number;
  items: GeneralExpenseItemRecord[];
  createdAt?: string;
  updatedAt?: string;
};

export type GeneralExpenseGroupRecord = {
  id: string;
  budgetId?: string;
  name: string;
  kind: GeneralExpenseGroupKind;
  sortOrder: number;
  titles: GeneralExpenseTitleRecord[];
  createdAt?: string;
  updatedAt?: string;
};

export type GeneralExpenseStructureRecord = {
  groups: GeneralExpenseGroupRecord[];
};

export type CalculatedGeneralExpenseItemRecord = GeneralExpenseItemRecord & {
  partial: number;
};

export type CalculatedGeneralExpenseTitleRecord = Omit<GeneralExpenseTitleRecord, "items"> & {
  items: CalculatedGeneralExpenseItemRecord[];
  subtotal: number;
};

export type CalculatedGeneralExpenseGroupRecord = Omit<GeneralExpenseGroupRecord, "titles"> & {
  titles: CalculatedGeneralExpenseTitleRecord[];
  subtotal: number;
};

export type CalculatedGeneralExpenseStructureRecord = {
  groups: CalculatedGeneralExpenseGroupRecord[];
  total: number;
  totalDirectCost: number;
};
