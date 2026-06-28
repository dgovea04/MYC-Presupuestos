import { z } from "zod";
import {
  AI_PROVIDER_OPTIONS,
  APP_THEME_OPTIONS,
  DEFAULT_APP_THEME,
  DATE_FORMAT_OPTIONS,
  DEFAULT_EXCEL_ROW_HEIGHT,
  DEFAULT_INITIAL_SUB_BUDGET_NAMES,
  DEFAULT_VIEW_MODE,
  EXCEL_ROW_HEIGHT_OPTIONS,
  FLOATING_KHIPU_DEFAULTS,
  FLOATING_KHIPU_FONT_SIZES,
  FLOATING_KHIPU_POSITIONS,
  FLOATING_KHIPU_THEMES,
  VIEW_MODE_OPTIONS,
} from "@/types/settings";

const numericInputSchema = z.union([
  z.number(),
  z
    .string()
    .trim()
    .min(1)
    .refine((value) => value !== "" && Number.isFinite(Number(value)), {
      message: "Expected a valid number",
    })
    .transform((value) => Number(value)),
]);

const decimalRateSchema = numericInputSchema.pipe(z.number().min(0).max(1));
const projectSubBudgetNameSchema = z.string();
const projectSubBudgetNamesSchema = z
  .array(projectSubBudgetNameSchema)
  .transform((names) => {
    const normalized = names.map((name) => name.trim()).filter((name) => name.length > 0);

    return [...new Set(normalized)];
  })
  .refine((names) => names.length > 0, {
    message: "Se requiere al menos un Sub Presupuesto inicial",
  });

export const userSettingsSchema = z.object({
  defaultCurrency: z.enum(["PEN", "USD"]),
  currencyDecimals: numericInputSchema.pipe(z.number().int().min(0).max(4)),
  dateFormat: z.enum(DATE_FORMAT_OPTIONS).default("DD_MMM_YYYY"),
  appTheme: z.enum(APP_THEME_OPTIONS).default(DEFAULT_APP_THEME),
  defaultViewMode: z.enum(VIEW_MODE_OPTIONS).default(DEFAULT_VIEW_MODE),
  excelShowFieldBorders: z.boolean().default(false),
  excelRowHeight: numericInputSchema.pipe(z.number().int().refine((value) => EXCEL_ROW_HEIGHT_OPTIONS.includes(value as 40 | 45 | 52 | 60), {
    message: "Expected a valid excel row height",
  })).default(DEFAULT_EXCEL_ROW_HEIGHT),
  defaultIgvRate: decimalRateSchema,
  defaultGeneralExpensesRate: decimalRateSchema,
  defaultUtilityRate: decimalRateSchema,
  defaultSubBudgetNames: projectSubBudgetNamesSchema.default([...DEFAULT_INITIAL_SUB_BUDGET_NAMES]),
  openaiApiKey: z.string().trim().optional().nullable(),
  geminiApiKey: z.string().trim().optional().nullable(),
  aiProviderPreference: z.enum(AI_PROVIDER_OPTIONS).default("auto"),
  openaiModel: z.string().trim().optional().nullable(),
  geminiModel: z.string().trim().optional().nullable(),
  floatingKhipuProvider: z.enum(AI_PROVIDER_OPTIONS).default(FLOATING_KHIPU_DEFAULTS.provider),
  floatingKhipuWidth: numericInputSchema.pipe(z.number().int().min(320).max(800)).default(FLOATING_KHIPU_DEFAULTS.width),
  floatingKhipuHeight: numericInputSchema.pipe(z.number().int().min(280).max(700)).default(FLOATING_KHIPU_DEFAULTS.height),
  floatingKhipuFontSize: z.enum(FLOATING_KHIPU_FONT_SIZES).default(FLOATING_KHIPU_DEFAULTS.fontSize),
  floatingKhipuPosition: z.enum(FLOATING_KHIPU_POSITIONS).default(FLOATING_KHIPU_DEFAULTS.position),
  floatingKhipuTheme: z.enum(FLOATING_KHIPU_THEMES).default(FLOATING_KHIPU_DEFAULTS.theme),
});

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
