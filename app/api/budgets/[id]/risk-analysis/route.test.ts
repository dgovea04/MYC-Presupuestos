import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { MONTE_CARLO_ITERATIONS } from "@/types/risk";
import {
  riskSimulationRunInputSchema,
  riskVariableInputSchema,
} from "@/lib/validations/risk";

describe("risk analysis validation", () => {
  it("accepts a valid quantity triangular variable", () => {
    const parsed = riskVariableInputSchema.parse({
      id: "risk-1",
      budgetItemId: "item-1",
      variableType: "QUANTITY",
      distributionType: "TRIANGULAR",
      minimum: 8,
      mostLikely: 10,
      maximum: 12,
      enabled: true,
    });

    expect(parsed).toEqual({
      id: "risk-1",
      budgetItemId: "item-1",
      variableType: "QUANTITY",
      distributionType: "TRIANGULAR",
      minimum: 8,
      mostLikely: 10,
      maximum: 12,
      enabled: true,
    });
  });

  it("rejects inverted triangular ranges", () => {
    expect(() =>
      riskVariableInputSchema.parse({
        budgetItemId: "item-1",
        variableType: "QUANTITY",
        distributionType: "TRIANGULAR",
        minimum: 12,
        mostLikely: 10,
        maximum: 8,
        enabled: true,
      }),
    ).toThrow(ZodError);
  });

  it("requires the fixed Monte Carlo iteration count for saved runs", () => {
    expect(() =>
      riskSimulationRunInputSchema.parse({
        ...validRunInput,
        iterations: MONTE_CARLO_ITERATIONS - 1,
      }),
    ).toThrow(ZodError);

    expect(riskSimulationRunInputSchema.parse(validRunInput).iterations).toBe(MONTE_CARLO_ITERATIONS);
  });
});

const validRunInput = {
  iterations: MONTE_CARLO_ITERATIONS,
  baseTotal: 1000,
  mean: 1100,
  median: 1090,
  variance: 120,
  standardDeviation: 10.95,
  skewness: 0.2,
  kurtosis: 2.8,
  p10: 980,
  p50: 1090,
  p80: 1150,
  p90: 1200,
  p95: 1240,
  histogramBins: [
    {
      min: 900,
      max: 1000,
      midpoint: 950,
      frequency: 100,
      probability: 0.01,
    },
  ],
  sCurvePoints: [
    {
      cost: 1000,
      cumulativeProbability: 0.5,
    },
  ],
};
