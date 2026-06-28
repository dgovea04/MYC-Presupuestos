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
export const APP_THEME_OPTIONS = ["light", "dark"] as const;

export type DateFormatOption = (typeof DATE_FORMAT_OPTIONS)[number];
export const DEFAULT_DATE_FORMAT: DateFormatOption = "DD_MMM_YYYY";
export type ViewModeOption = (typeof VIEW_MODE_OPTIONS)[number];
export const DEFAULT_VIEW_MODE: ViewModeOption = "modern";
export type AppThemeOption = (typeof APP_THEME_OPTIONS)[number];
export const DEFAULT_APP_THEME: AppThemeOption = "light";
export const DEFAULT_EXCEL_SHOW_FIELD_BORDERS = false;
export const DEFAULT_EXCEL_ROW_HEIGHT = 40;

export const AI_PROVIDER_OPTIONS = ["auto", "ollama", "chatgpt_bridge", "openai", "gemini", "openrouter"] as const;
export type AiProviderPreference = (typeof AI_PROVIDER_OPTIONS)[number];

export const FLOATING_KHIPU_POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"] as const;
export type FloatingKhipuPosition = (typeof FLOATING_KHIPU_POSITIONS)[number];

export const FLOATING_KHIPU_FONT_SIZES = ["compact", "normal", "large"] as const;
export type FloatingKhipuFontSize = (typeof FLOATING_KHIPU_FONT_SIZES)[number];

export const FLOATING_KHIPU_THEMES = ["light", "dark"] as const;
export type FloatingKhipuTheme = (typeof FLOATING_KHIPU_THEMES)[number];

export const FLOATING_KHIPU_DEFAULTS = {
  provider: "ollama" as AiProviderPreference,
  width: 600,
  height: 500,
  fontSize: "normal" as FloatingKhipuFontSize,
  position: "bottom-right" as FloatingKhipuPosition,
  theme: "light" as FloatingKhipuTheme,
} as const;

export type UserSettingsRecord = {
  defaultCurrency: "PEN" | "USD";
  currencyDecimals: number;
  dateFormat: DateFormatOption;
  appTheme?: AppThemeOption;
  defaultViewMode: ViewModeOption;
  excelShowFieldBorders: boolean;
  excelRowHeight: number;
  defaultIgvRate: number;
  defaultGeneralExpensesRate: number;
  defaultUtilityRate: number;
  defaultSubBudgetNames: string[];
  openaiApiKey?: string;
  geminiApiKey?: string;
  aiProviderPreference: AiProviderPreference;
  openaiModel?: string;
  geminiModel?: string;
  floatingKhipuProvider: AiProviderPreference;
  floatingKhipuWidth: number;
  floatingKhipuHeight: number;
  floatingKhipuFontSize: FloatingKhipuFontSize;
  floatingKhipuPosition: FloatingKhipuPosition;
  floatingKhipuTheme: FloatingKhipuTheme;
};
