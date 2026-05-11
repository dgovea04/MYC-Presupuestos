import type { ApuRecord } from "@/types/apu";

export type BudgetLevelType = "TITLE" | "SUBTITLE" | "ITEM_GROUP" | "SUBITEM";
export type BudgetKind = "GENERAL" | "SUB_BUDGET";

export type BudgetLevelRecord = {
  id: string;
  budgetId: string;
  parentId?: string | null;
  type: BudgetLevelType;
  code: string;
  name: string;
  sortOrder: number;
};

export type BudgetItemRecord = {
  id: string;
  budgetId: string;
  levelId?: string | null;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
  sortOrder: number;
  apu?: ApuRecord | null;
};

export type BudgetTotals = {
  totalDirectCost: number;
  totalGeneralExpenses: number;
  totalUtility: number;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
};

export type BudgetRecord = {
  id: string;
  projectId: string;
  parentBudgetId?: string | null;
  kind: BudgetKind;
  name: string;
  currency: string;
  igvRate: number;
  generalExpensesRate: number;
  utilityRate: number;
  totalDirectCost: number;
  totalGeneralExpenses: number;
  totalUtility: number;
  totalTax: number;
  totalAmount: number;
  levels: BudgetLevelRecord[];
  items: BudgetItemRecord[];
};

export type BudgetPatchBudgetFields = Pick<
  BudgetRecord,
  | "name"
  | "currency"
  | "igvRate"
  | "generalExpensesRate"
  | "utilityRate"
  | "totalDirectCost"
  | "totalGeneralExpenses"
  | "totalUtility"
  | "totalTax"
  | "totalAmount"
>;

export type BudgetLevelUpdatePatch = {
  id: string;
  changes: Partial<Omit<BudgetLevelRecord, "id">>;
};

export type BudgetItemUpdatePatch = {
  id: string;
  changes: Partial<Omit<BudgetItemRecord, "id">>;
};

export type BudgetStatePatch = {
  budget: Partial<BudgetPatchBudgetFields>;
  levels: {
    create: BudgetLevelRecord[];
    update: BudgetLevelUpdatePatch[];
    delete: string[];
  };
  items: {
    create: BudgetItemRecord[];
    update: BudgetItemUpdatePatch[];
    delete: string[];
  };
};
