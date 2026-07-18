import { z } from "zod";
import { MONTE_CARLO_ITERATIONS } from "@/types/risk";

const finiteNonnegativeNumber = z.number().finite().nonnegative();

const riskVariableRangeSchema = z
  .object({
    budgetItemId: z.string().min(1),
    variableType: z.enum(["QUANTITY", "UNIT_PRICE", "DURATION"]),
    distributionType: z.enum(["TRIANGULAR", "PERT", "NORMAL", "UNIFORM"]),
    minimum: finiteNonnegativeNumber,
    mostLikely: finiteNonnegativeNumber,
    maximum: finiteNonnegativeNumber,
  })
  .refine((input) => input.minimum <= input.mostLikely, {
    message: "El minimo no puede ser mayor que el valor probable.",
    path: ["minimum"],
  })
  .refine((input) => input.mostLikely <= input.maximum, {
    message: "El valor probable no puede ser mayor que el maximo.",
    path: ["mostLikely"],
  });

export const riskVariableInputSchema = riskVariableRangeSchema.extend({
  id: z.string().optional(),
  enabled: z.boolean(),
  delete: z.boolean().optional(),
});

export const riskVariablesSaveSchema = z.object({
  variables: z.array(riskVariableInputSchema),
});

export const riskInputSourceSchema = z.enum(["MANUAL", "AGENT", "HEURISTIC"]);
export const riskSuggestionStrategySchema = z.enum(["balanced", "conservative", "aggressive"]);

export const riskVariableSuggestionSchema = riskVariableRangeSchema.extend({
  id: z.string().min(1),
  budgetId: z.string().min(1),
  itemCode: z.string().min(1),
  itemDescription: z.string().min(1),
  sourceBudgetName: z.string().min(1),
  confidence: z.number().finite().min(0).max(1),
  reason: z.string().min(1),
  source: z.enum(["HEURISTIC", "AGENT"]),
  impactScore: z.number().finite().nonnegative(),
});

export const riskCorrelationInputSchema = z
  .object({
    id: z.string().optional(),
    sourceVariableId: z.string().min(1),
    targetVariableId: z.string().min(1),
    coefficient: z.number().finite().min(-1).max(1),
    delete: z.boolean().optional(),
  })
  .refine((input) => input.sourceVariableId !== input.targetVariableId, {
    message: "Una correlacion requiere dos variables distintas.",
    path: ["targetVariableId"],
  });

export const riskCorrelationsSaveSchema = z.object({
  correlations: z.array(riskCorrelationInputSchema),
});

export const riskHistogramBinSchema = z.object({
  min: z.number().finite(),
  max: z.number().finite(),
  midpoint: z.number().finite(),
  frequency: z.number().int().nonnegative(),
  probability: finiteNonnegativeNumber,
});

export const riskSCurvePointSchema = z.object({
  cost: z.number().finite(),
  cumulativeProbability: z.number().finite().min(0).max(1),
});

export const riskScheduleDurationSummarySchema = z.object({
  iterations: z.number().int().positive(),
  baseProjectDurationDays: z.number().int().nonnegative(),
  meanDurationDays: z.number().finite().nonnegative(),
  medianDurationDays: z.number().finite().nonnegative(),
  p80DurationDays: z.number().finite().nonnegative(),
  p90DurationDays: z.number().finite().nonnegative(),
  p95DurationDays: z.number().finite().nonnegative(),
  minimumDurationDays: z.number().finite().nonnegative(),
  maximumDurationDays: z.number().finite().nonnegative(),
  criticalItemCount: z.number().int().nonnegative(),
  histogramBins: z.array(riskHistogramBinSchema),
  sCurvePoints: z.array(riskSCurvePointSchema),
});

export const riskSimulationRunInputSchema = z.object({
  budgetId: z.string().min(1),
  iterations: z.literal(MONTE_CARLO_ITERATIONS),
  baseTotal: finiteNonnegativeNumber,
  mean: finiteNonnegativeNumber,
  median: finiteNonnegativeNumber,
  variance: finiteNonnegativeNumber,
  standardDeviation: finiteNonnegativeNumber,
  skewness: z.number().finite(),
  kurtosis: z.number().finite(),
  p10: finiteNonnegativeNumber,
  p50: finiteNonnegativeNumber,
  p80: finiteNonnegativeNumber,
  p90: finiteNonnegativeNumber,
  p95: finiteNonnegativeNumber,
  histogramBins: z.array(riskHistogramBinSchema),
  sCurvePoints: z.array(riskSCurvePointSchema),
  scheduleDuration: riskScheduleDurationSummarySchema.nullable(),
});

export const riskSimulationRunRequestSchema = z.object({
  budgetId: z.string().min(1),
  scenarioId: z.string().min(1).optional(),
  seed: z.string().min(1).optional(),
});

export type RiskVariablesSaveInput = z.infer<typeof riskVariablesSaveSchema>;
export type RiskCorrelationsSaveInput = z.infer<typeof riskCorrelationsSaveSchema>;
export type RiskSimulationRunInput = z.infer<typeof riskSimulationRunInputSchema>;
export type RiskSimulationRunRequestInput = z.infer<typeof riskSimulationRunRequestSchema>;
