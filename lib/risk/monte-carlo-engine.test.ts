import { describe, expect, it } from "vitest";
import {
  buildHistogram,
  buildSCurve,
  calculateKurtosis,
  calculateMean,
  calculatePercentile,
  calculateSkewness,
  calculateStandardDeviation,
  calculateVariance,
} from "@/lib/risk/statistics";
import { runMonteCarloSimulation, sampleTriangular } from "@/lib/risk/monte-carlo-engine";
import type { RiskSimulationInput, RiskVariableRecord } from "@/types/risk";

describe("risk statistics", () => {
  const values = [10, 20, 30, 40, 50];

  it("calculates percentiles using linear interpolation", () => {
    expect(calculatePercentile(values, 0.1)).toBe(14);
    expect(calculatePercentile(values, 0.5)).toBe(30);
    expect(calculatePercentile(values, 0.9)).toBe(46);
  });

  it("calculates variance and standard deviation", () => {
    expect(calculateMean(values)).toBe(30);
    expect(calculateVariance(values)).toBe(200);
    expect(calculateStandardDeviation(values)).toBeCloseTo(14.1421, 4);
  });

  it("calculates skewness and kurtosis for symmetric data", () => {
    expect(calculateSkewness(values)).toBeCloseTo(0, 8);
    expect(calculateKurtosis(values)).toBeCloseTo(-1.3, 8);
  });

  it("builds histogram bins and s-curve points", () => {
    const histogram = buildHistogram(values, 5);
    const sCurve = buildSCurve(values, 5);

    expect(histogram).toHaveLength(5);
    expect(histogram.reduce((sum, bin) => sum + bin.frequency, 0)).toBe(5);
    expect(histogram.reduce((sum, bin) => sum + bin.probability, 0)).toBeCloseTo(1, 8);
    expect(sCurve).toHaveLength(5);
    expect(sCurve.at(-1)?.cumulativeProbability).toBe(1);
  });
});

describe("monte carlo engine", () => {
  const baseSimulationInput: RiskSimulationInput = {
    budgetId: "budget-1",
    baseTotal: 1000,
    iterations: 4,
    items: [
      {
        itemId: "item-1",
        budgetId: "child-1",
        sourceBudgetName: "Estructuras",
        code: "01.01",
        description: "Excavacion",
        unit: "m3",
        baseQuantity: 10,
        unitPrice: 100,
        baseTotal: 1000,
      },
    ],
    variables: [
      {
        id: "risk-1",
        budgetId: "budget-1",
        budgetItemId: "item-1",
        variableType: "QUANTITY",
        distributionType: "TRIANGULAR",
        minimum: 8,
        mostLikely: 10,
        maximum: 12,
        enabled: true,
      },
    ],
  };

  it("samples triangular values inside the configured range", () => {
    const value = sampleTriangular({ minimum: 10, mostLikely: 15, maximum: 20 }, () => 0.5);
    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThanOrEqual(20);
  });

  it("rejects invalid triangular ranges", () => {
    expect(() => sampleTriangular({ minimum: 20, mostLikely: 15, maximum: 10 }, () => 0.5)).toThrow("triangular");
  });

  it("runs a deterministic simulation and returns required metrics", () => {
    const progressEvents: Array<[number, number]> = [];

    const summary = runMonteCarloSimulation(
      baseSimulationInput,
      {
        random: () => 0.5,
        histogramBinCount: 4,
        sCurvePointCount: 4,
        progressInterval: 2,
        onProgress: (completedIterations, totalIterations) => {
          progressEvents.push([completedIterations, totalIterations]);
        },
      },
    );

    expect(summary).toMatchObject({
      budgetId: "budget-1",
      iterations: 4,
      baseTotal: 1000,
      mean: 1000,
      median: 1000,
      p10: 1000,
      p50: 1000,
      p80: 1000,
      p90: 1000,
      p95: 1000,
    });
    expect(summary.histogramBins).toHaveLength(1);
    expect(summary.sCurvePoints).toHaveLength(4);
    expect(progressEvents).toEqual([
      [2, 4],
      [4, 4],
    ]);
  });

  it("ignores enabled variables whose item is absent", () => {
    const missingItemVariable: RiskVariableRecord = {
      ...baseSimulationInput.variables[0],
      id: "missing-item-risk",
      budgetItemId: "missing-item",
      minimum: 100,
      mostLikely: 100,
      maximum: 100,
    };

    const summary = runMonteCarloSimulation(
      {
        ...baseSimulationInput,
        variables: [missingItemVariable],
      },
      { random: () => 0.5 },
    );

    expect(summary.mean).toBe(1000);
    expect(summary.p95).toBe(1000);
  });

  it("rejects unsupported enabled variable types and distributions", () => {
    const unsupportedType = {
      ...baseSimulationInput.variables[0],
      variableType: "UNIT_PRICE",
    } as unknown as RiskVariableRecord;
    const unsupportedDistribution = {
      ...baseSimulationInput.variables[0],
      distributionType: "NORMAL",
    } as unknown as RiskVariableRecord;

    expect(() =>
      runMonteCarloSimulation({ ...baseSimulationInput, variables: [unsupportedType] }, { random: () => 0.5 }),
    ).toThrow("Unsupported risk variable type");
    expect(() =>
      runMonteCarloSimulation({ ...baseSimulationInput, variables: [unsupportedDistribution] }, { random: () => 0.5 }),
    ).toThrow("Unsupported risk distribution type");
  });
});
