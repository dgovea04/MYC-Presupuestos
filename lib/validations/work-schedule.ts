import Decimal from "decimal.js";
import { z } from "zod";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresa una fecha valida en formato YYYY-MM-DD");

const positiveDecimalSchema = (fieldName: string) =>
  z.coerce.number().refine((value) => {
    try {
      return new Decimal(value).greaterThan(0);
    } catch {
      return false;
    }
  }, `${fieldName} debe ser mayor que cero`);

const percentageSchema = z.coerce.number().refine((value) => {
  try {
    const decimal = new Decimal(value);
    return decimal.greaterThan(0) && decimal.lessThanOrEqualTo(100);
  } catch {
    return false;
  }
}, "El porcentaje debe estar entre 0 y 100");

export const workScheduleDistributionInputSchema = z.object({
  year: z.coerce.number().int().min(2000),
  month: z.coerce.number().int().min(1).max(12),
  percentage: percentageSchema,
});

export const workScheduleItemSaveSchema = z.object({
  budgetItemId: z.string().trim().min(1, "Selecciona una partida"),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  durationDays: z.coerce.number().int().min(1, "La duracion debe ser mayor que cero"),
  predecessor: z.string().trim().max(80).optional().nullable(),
  crew: positiveDecimalSchema("La cuadrilla").optional().nullable(),
  monthlyDistributions: z.array(workScheduleDistributionInputSchema).min(1, "Registra al menos un periodo"),
});

export type WorkScheduleDistributionInput = z.infer<typeof workScheduleDistributionInputSchema>;
export type WorkScheduleItemSaveInput = z.infer<typeof workScheduleItemSaveSchema>;
