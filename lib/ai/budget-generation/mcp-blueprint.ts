// ─── BudgetBlueprint: intermediate structure extracted from .mcp packages ───
//
// The blueprint separates .mcp reading from persistence. It stores monetary
// values as strings to preserve precision until they reach the calculation layer.

export type McpBudgetBlueprint = {
  sourcePackageId: string;
  sourceProjectName: string;
  sourceFormatVersion: string;
  projectType: string | null;
  confidence: number;
  assumptions: string[];
  warnings: string[];
  subBudgets: McpSubBudgetBlueprint[];
  /** Resources from the source project (project-resources.json). Optional — absent in older .mcp exports. */
  projectResources?: McpProjectResource[];
};

export type McpSubBudgetBlueprint = {
  sourceBudgetId: string;
  name: string;
  normalizedName: string;
  currency: "PEN" | "USD";
  igvRate: string;
  generalExpensesRate: string;
  utilityRate: string;
  levels: McpBudgetLevelBlueprint[];
  items: McpBudgetItemBlueprint[];
};

export type McpBudgetLevelBlueprint = {
  sourceLevelId: string;
  parentSourceLevelId: string | null;
  type: "TITLE" | "SUBTITLE" | "ITEM_GROUP" | "SUBITEM";
  code: string;
  name: string;
  sortOrder: number;
};

export type McpBudgetItemBlueprint = {
  sourceItemId: string;
  sourceCode: string;
  description: string;
  normalizedDescription: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  partial: string;
  sortOrder: number;
  levelSourceId: string | null;
  apu: McpApuBlueprint | null;
};

export type McpApuBlueprint = {
  name: string;
  unit: string;
  performance: string;
  totalUnitCost: string;
  resources: McpApuResourceBlueprint[];
};

export type McpApuResourceBlueprint = {
  resourceType: string;
  crew: string | null;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  resourceDescription: string | null;
  /** Original resource ID from the source project's Resource table. Used to match projectResources. */
  resourceSourceId: string | null;
};

export type McpProjectResource = {
  id: string;
  code: string;
  description: string;
  category: string;
  unit: string;
  currency: string;
  unitPrice: string;
  iu: string | null;
  iuCurrent: string | null;
};
