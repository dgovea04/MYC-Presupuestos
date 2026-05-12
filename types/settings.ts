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

export type DateFormatOption = (typeof DATE_FORMAT_OPTIONS)[number];
export const DEFAULT_DATE_FORMAT: DateFormatOption = "DD_MMM_YYYY";

export type UserSettingsRecord = {
  defaultCurrency: "PEN" | "USD";
  currencyDecimals: number;
  dateFormat: DateFormatOption;
  defaultIgvRate: number;
  defaultGeneralExpensesRate: number;
  defaultUtilityRate: number;
  defaultSubBudgetNames: string[];
};
