import { z } from "zod";
import { MONTE_CARLO_ITERATIONS } from "@/types/risk";

const finiteNonnegativeNumber = z.number().finite().nonnegative();

export const riskVariableInputSchema = z
  .object({
    id: z.string().optional(),
    budgetItemId: z.string().min(1),
    variableType: z.literal("QUANTITY"),
    distributionType: z.literal("TRIANGULAR"),
    minimum: finiteNonnegativeNumber,
    mostLikely: finiteNonnegativeNumber,
    maximum: finiteNonnegativeNumber,
    enabled: z.boolean(),
    delete: z.boolean().optional(),
  })
  .refine((input) => input.minimum <= input.mostLikely, {
    message: "El minimo no puede ser mayor que el valor probable.",
    path: ["minimum"],
  })
  .refine((input) => input.mostLikely <= input.maximum, {
    message: "El valor probable no puede ser mayor que el maximo.",
    path: ["mostLikely"],
  });

export const riskVariablesSaveSchema = z.object({
  variables: z.array(riskVariableInputSchema),
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

export const riskSimulationRunInputSchema = z.object({
  iterations: z.literal(MONTE_CARLO_ITERATIONS),
});

export type RiskVariablesSaveInput = z.infer<typeof riskVariablesSaveSchema>;
export type RiskSimulationRunInput = z.infer<typeof riskSimulationRunInputSchema>;
