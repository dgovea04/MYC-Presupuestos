import { z } from "zod";

export const budgetFooterRowSchema = z.object({
  id: z.string().min(1),
  variable: z.string().trim().min(1, "Ingresa la variable"),
  description: z.string().trim().min(1, "Ingresa la descripcion"),
  formula: z.string().trim().nullable().optional(),
  manualValue: z.coerce.number(),
  iu: z.string().trim().nullable().optional(),
  highlight: z.coerce.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});

export const budgetFooterStructureSaveSchema = z.object({
  rows: z.array(budgetFooterRowSchema),
});

export type BudgetFooterRowInput = z.infer<typeof budgetFooterRowSchema>;
export type BudgetFooterStructureSaveInput = z.infer<typeof budgetFooterStructureSaveSchema>;
