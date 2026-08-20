export type PdfImportDocumentRole = "BUDGET" | "APU" | "SUBPARTIDAS" | "OTHER" | "AUTO";

export type PdfImportLinkStatus =
  | "MATCHED"
  | "AMBIGUOUS"
  | "MISSING_APU"
  | "MISSING_BUDGET_ITEM"
  | "UNIT_MISMATCH"
  | "PRICE_MISMATCH"
  | "NEEDS_REVIEW";

export type PdfImportValidationSeverity = "error" | "warning" | "info";

export type PdfImportSourceEvidence = {
  sourceFileName: string;
  sourcePage: number;
  rawText: string;
  confidence: number;
};

export type PdfImportSourceFile = {
  id: string;
  fileName: string;
  role: PdfImportDocumentRole;
  pageCount: number;
  confidence: number;
};

export type PdfImportedProject = {
  name: string;
  currency: string;
};

export type PdfImportedBudgetLevel = {
  id: string;
  code: string;
  name: string;
  type: "TITLE" | "SUBTITLE" | "ITEM_GROUP" | "SUBITEM";
  parentId?: string | null;
  sortOrder: number;
};

export type PdfImportedBudgetItem = {
  id: string;
  levelId?: string | null;
  code: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  partial: string;
  sortOrder: number;
  evidence: PdfImportSourceEvidence;
  needsReview?: boolean;
  reviewReason?: string | null;
};

export type PdfImportedBudget = {
  id: string;
  name: string;
  kind: "GENERAL" | "SUB_BUDGET";
  currency: string;
  levels: PdfImportedBudgetLevel[];
  items: PdfImportedBudgetItem[];
};

export type PdfImportedApuRow = {
  id: string;
  description: string;
  unit: string;
  resourceType: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  sortOrder: number;
  evidence: PdfImportSourceEvidence;
  catalogSubpartidaId?: string | null;
  resourceId?: string | null;
  needsReview?: boolean;
  reviewReason?: string | null;
};

export type PdfImportedApu = {
  id: string;
  budgetItemCode?: string | null;
  name: string;
  unit: string;
  performance: string;
  totalUnitCost: string;
  rows: PdfImportedApuRow[];
  evidence: PdfImportSourceEvidence;
};

export type PdfImportedSubpartida = {
  id: string;
  code?: string | null;
  description: string;
  unit: string;
  unitPrice: string;
  performance: string;
  rows: PdfImportedApuRow[];
  evidence: PdfImportSourceEvidence;
};

export type PdfImportedResource = {
  id: string;
  code: string;
  description: string;
  category: "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS" | "OTHER";
  unit: string;
  unitPrice: string;
  currency: string;
  evidence: PdfImportSourceEvidence;
};

export type PdfImportLink = {
  id: string;
  fromId: string;
  toId?: string | null;
  kind: "BUDGET_ITEM_APU" | "APU_SUBPARTIDA" | "APU_ROW_RESOURCE";
  status: PdfImportLinkStatus;
  confidence: number;
  reason: string;
};

export type PdfImportValidation = {
  id: string;
  severity: PdfImportValidationSeverity;
  code: string;
  message: string;
  entityId?: string | null;
};

export type PdfImportReviewApproval = {
  id: string;
  validationCode: string;
  entityId: string;
  reason: string;
};

export type PdfAiImportDraft = {
  source: "PDF_AI";
  project: PdfImportedProject;
  sourceFiles: PdfImportSourceFile[];
  budgets: PdfImportedBudget[];
  apus: PdfImportedApu[];
  subpartidas: PdfImportedSubpartida[];
  resources: PdfImportedResource[];
  links: PdfImportLink[];
  validations: PdfImportValidation[];
  reviewApprovals?: PdfImportReviewApproval[];
  warnings: string[];
};
