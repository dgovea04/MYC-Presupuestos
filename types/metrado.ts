export type MetradoTemplateType =
  | "CONCRETE"
  | "REBAR"
  | "FORMWORK"
  | "MASONRY"
  | "PLASTER"
  | "PAINT"
  | "EXCAVATION"
  | "FLOORING"
  | "ROOFING"
  | "CUSTOM";

export type MetradoUnit = "m" | "m2" | "m3" | "kg" | "und" | "glb";

export type MetradoSheetStatus = "DRAFT" | "VALIDATED" | "SENT_TO_BUDGET";

export type MetradoFormulaKey =
  | "volume"
  | "area"
  | "linear"
  | "rebarWeight"
  | "formworkArea"
  | "factorArea"
  | "manual";

export type MetradoFormulaInputKey =
  | "largo"
  | "ancho"
  | "alto"
  | "cantidad"
  | "longitud"
  | "pesoUnitario"
  | "perimetro"
  | "altura"
  | "area"
  | "factor"
  | "manual";

export type MetradoFormulaInputs = Partial<
  Record<MetradoFormulaInputKey, number>
>;

export type MetradoFormulaRecord = {
  id: string;
  templateId: string;
  key: MetradoFormulaKey;
  label: string;
  expression: string;
  requiredInputs: MetradoFormulaInputKey[];
  resultUnit: MetradoUnit;
};

export type MetradoTemplateRecord = {
  id: string;
  type: MetradoTemplateType;
  name: string;
  description: string;
  defaultUnit: MetradoUnit;
  formulaKeys: MetradoFormulaKey[];
  formulas: MetradoFormulaRecord[];
};

export type MetradoRowRecord = {
  id: string;
  sheetId: string;
  sector: string;
  eje: string;
  nivel: string;
  description: string;
  unit: MetradoUnit;
  formulaKey: MetradoFormulaKey;
  inputs: MetradoFormulaInputs;
  partial: number;
  sortOrder: number;
};

export type MetradoPartidaLinkRecord = {
  id: string;
  sheetId: string;
  budgetItemId: string;
  budgetItemCode: string;
  budgetItemDescription: string;
  budgetItemUnit: string;
  lastSentQuantity: number | null;
};

export type MetradoSheetRecord = {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  budgetId: string;
  budgetName: string;
  templateId: string;
  templateType: MetradoTemplateType;
  name: string;
  status: MetradoSheetStatus;
  unit: MetradoUnit;
  totalQuantity: number;
  rows: MetradoRowRecord[];
  partidaLink: MetradoPartidaLinkRecord | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type MetradoValidationSeverity = "error" | "warning";

export type MetradoValidationIssue = {
  id: string;
  severity: MetradoValidationSeverity;
  rowId?: string;
  field?: string;
  message: string;
};

export type MetradoCalculationResult = {
  rows: MetradoRowRecord[];
  totalsByUnit: Record<MetradoUnit, number>;
  primaryTotal: number;
  issues: MetradoValidationIssue[];
};
