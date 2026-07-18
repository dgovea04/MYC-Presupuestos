import Decimal from "decimal.js";
import { z } from "zod";
import { parseWorkSchedulePredecessors } from "@/lib/work-schedule/predecessors";

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
  durationDays: z.coerce.number().int().min(0, "La duracion debe ser mayor o igual a cero"),
  isMilestone: z.boolean().optional().default(false),
  baselineStartDate: isoDateSchema.optional().nullable(),
  baselineEndDate: isoDateSchema.optional().nullable(),
  actualStartDate: isoDateSchema.optional().nullable(),
  actualEndDate: isoDateSchema.optional().nullable(),
  percentComplete: z.coerce.number().min(0, "El porcentaje no puede ser negativo").max(100, "El porcentaje no puede superar 100").optional().nullable(),
  predecessor: z.string().trim().max(240).optional().nullable().superRefine((value, context) => {
    try {
      parseWorkSchedulePredecessors(value);
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Ingresa una predecesora valida",
      });
    }
  }),
  crew: positiveDecimalSchema("La cuadrilla").optional().nullable(),
  monthlyDistributions: z.array(workScheduleDistributionInputSchema).min(1, "Registra al menos un periodo"),
});

export const workScheduleGenerationStrategySchema = z.enum(["sequential", "by_level", "by_similarity", "by_front"]);

export const interSubBudgetParallelismSchema = z.enum(["independent", "staggered", "parallel"]);

export const levelLinkageModeSchema = z.enum(["chain", "parallel"]);

import { WORK_FRONT_PHASE_KEYWORDS } from "@/lib/work-schedule/work-front-phase";

const WORK_SCHEDULE_FRONT_PHASES = Object.keys(WORK_FRONT_PHASE_KEYWORDS).filter((phase) => phase !== "other");

export const workScheduleFrontPhaseSchema = z.enum([
  "preliminaries",
  "earthwork",
  "structure",
  "masonry",
  "installations",
  "finishes",
  "testing",
  "other",
]);

export const workScheduleGenerationCustomPhaseKeywordsSchema = z
  .record(z.string(), z.array(z.string().trim().min(1)).min(1))
  .refine((value) => Object.keys(value).every((key) => WORK_SCHEDULE_FRONT_PHASES.includes(key)), {
    message: "Invalid phase key in customPhaseKeywords",
  });

export const workScheduleGenerationSettingsSchema = z.object({
  strategy: workScheduleGenerationStrategySchema.default("sequential"),
  interSubBudgetParallelism: interSubBudgetParallelismSchema.default("independent"),
  interSubBudgetStaggerDays: z.coerce.number().int().min(1).max(365).optional().nullable().default(7),
  maxDurationDays: z.coerce.number().int().min(1).max(36525).optional().nullable(),
  similarityLagDays: z.coerce.number().int().min(0).max(365).optional().nullable().default(0),
  levelLinkage: z.record(z.string(), levelLinkageModeSchema).optional().nullable(),
  customPhaseKeywords: workScheduleGenerationCustomPhaseKeywordsSchema.optional().nullable(),
});

export const workScheduleGenerationOptionsSchema = workScheduleGenerationSettingsSchema;

export const workScheduleGenerateBaseSchema = z.object({
  baseStartDate: isoDateSchema,
  reviewedBudgetItemIds: z.array(z.string().trim().min(1)).optional(),
  options: workScheduleGenerationOptionsSchema.optional(),
  mode: z.enum(["full", "incremental"]).optional(),
});

export type WorkScheduleDistributionInput = z.infer<typeof workScheduleDistributionInputSchema>;
export type WorkScheduleItemSaveInput = z.infer<typeof workScheduleItemSaveSchema>;
export type WorkScheduleGenerateBaseInput = z.infer<typeof workScheduleGenerateBaseSchema>;
export type WorkScheduleGenerationSettings = z.infer<typeof workScheduleGenerationSettingsSchema>;
