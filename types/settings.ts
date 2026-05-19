export const DEFAULT_INITIAL_SUB_BUDGET_NAMES = [
  "Estructuras",
  "Arquitectura",
  "Instalaciones Sanitarias",
  "Instalaciones Electricas",
] as const;

export const DATE_FORMAT_OPTIONS = [
  "DD_MM_YYYY",
  "DD_MMM_YYYY",
  "DD_MM",
] as const;

export const VIEW_MODE_OPTIONS = ["modern", "excel"] as const;
export const EXCEL_ROW_HEIGHT_OPTIONS = [40, 45, 52, 60] as const;

export type DateFormatOption = (typeof DATE_FORMAT_OPTIONS)[number];
export const DEFAULT_DATE_FORMAT: DateFormatOption = "DD_MMM_YYYY";
export type ViewModeOption = (typeof VIEW_MODE_OPTIONS)[number];
export const DEFAULT_VIEW_MODE: ViewModeOption = "modern";
export const DEFAULT_EXCEL_SHOW_FIELD_BORDERS = true;
export const DEFAULT_EXCEL_ROW_HEIGHT = 52;

export type UserSettingsRecord = {
  defaultCurrency: "PEN" | "USD";
  currencyDecimals: number;
  dateFormat: DateFormatOption;
  defaultViewMode: ViewModeOption;
  excelShowFieldBorders: boolean;
  excelRowHeight: number;
  defaultIgvRate: number;
  defaultGeneralExpensesRate: number;
  defaultUtilityRate: number;
  defaultSubBudgetNames: string[];
};
