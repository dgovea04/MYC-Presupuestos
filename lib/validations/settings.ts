import { z } from "zod";
import { DATE_FORMAT_OPTIONS, DEFAULT_INITIAL_SUB_BUDGET_NAMES } from "@/types/settings";

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
    message: "Se requiere al menos una especialidad inicial",
  });

export const userSettingsSchema = z.object({
  defaultCurrency: z.enum(["PEN", "USD"]),
  currencyDecimals: numericInputSchema.pipe(z.number().int().min(0).max(4)),
  dateFormat: z.enum(DATE_FORMAT_OPTIONS).default("DD_MMM_YYYY"),
  defaultIgvRate: decimalRateSchema,
  defaultGeneralExpensesRate: decimalRateSchema,
  defaultUtilityRate: decimalRateSchema,
  defaultSubBudgetNames: projectSubBudgetNamesSchema.default([...DEFAULT_INITIAL_SUB_BUDGET_NAMES]),
});

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
