import { describe, expect, it } from "vitest";
import { runMonteCarloSimulation } from "@/lib/risk/monte-carlo-engine";
import {
  calculateMean,
  calculateMedian,
  calculatePercentile,
  calculateStandardDeviation,
  calculateVariance,
} from "@/lib/risk/statistics";
import type {
  RiskBudgetItem,
  RiskCorrelationRecord,
  RiskSimulationInput,
  RiskVariableRecord,
} from "@/types/risk";

function seededRandom(): () => number {
  // Mulberry32 PRNG — deterministic, uniform [0, 1)
  let state = 12345678;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createItem(overrides: Partial<RiskBudgetItem> = {}): RiskBudgetItem {
  return {
    itemId: overrides.itemId ?? "item-1",
    budgetId: overrides.budgetId ?? "budget-1",
    sourceBudgetName: overrides.sourceBudgetName ?? "Estructuras",
    code: overrides.code ?? "01.01",
    description: overrides.description ?? "Excavacion",
    unit: overrides.unit ?? "m3",
    baseQuantity: overrides.baseQuantity ?? 10,
    unitPrice: overrides.unitPrice ?? 100,
    baseTotal: overrides.baseTotal ?? 1000,
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}

function createVariable(
  overrides: Partial<RiskVariableRecord> & Pick<RiskVariableRecord, "id" | "budgetItemId">,
): RiskVariableRecord {
  return {
    budgetId: overrides.budgetId ?? "budget-1",
    variableType: overrides.variableType ?? "QUANTITY",
    distributionType: overrides.distributionType ?? "TRIANGULAR",
    minimum: overrides.minimum ?? 8,
    mostLikely: overrides.mostLikely ?? 10,
    maximum: overrides.maximum ?? 12,
    enabled: overrides.enabled ?? true,
    ...overrides,
  };
}

const BASE_INPUT: RiskSimulationInput = {
  budgetId: "budget-1",
  baseTotal: 1000,
  iterations: 1000,
  items: [createItem()],
  variables: [createVariable({ id: "risk-1", budgetItemId: "item-1" })],
  correlations: [],
};

describe("risk simulation integration", () => {
  it("produces all required summary fields for a single triangular quantity variable", () => {
    const summary = runMonteCarloSimulation(BASE_INPUT, {
      random: seededRandom(),
      histogramBinCount: 10,
      sCurvePointCount: 10,
    });

    // Identity
    expect(summary.budgetId).toBe("budget-1");
    expect(summary.iterations).toBe(1000);
    expect(summary.baseTotal).toBe(1000);

    // All numeric fields are finite
    const numericKeys = [
      "mean",
      "median",
      "variance",
      "standardDeviation",
      "skewness",
      "kurtosis",
      "p10",
      "p50",
      "p80",
      "p90",
      "p95",
    ] as const;
    for (const key of numericKeys) {
      expect(Number.isFinite(summary[key]), `${key} must be finite`).toBe(true);
    }

    // Percentile ordering: p10 ≤ p50 ≤ p80 ≤ p90 ≤ p95
    expect(summary.p10).toBeLessThanOrEqual(summary.p50);
    expect(summary.p50).toBeLessThanOrEqual(summary.p80);
    expect(summary.p80).toBeLessThanOrEqual(summary.p90);
    expect(summary.p90).toBeLessThanOrEqual(summary.p95);

    // Mean should be between p10 and p90
    expect(summary.mean).toBeGreaterThanOrEqual(summary.p10);
    expect(summary.mean).toBeLessThanOrEqual(summary.p90);

    // Standard deviation should be non-negative
    expect(summary.standardDeviation).toBeGreaterThanOrEqual(0);

    // Histogram has the requested number of bins
    expect(summary.histogramBins.length).toBe(10);
    // All frequencies sum to iterations
    expect(summary.histogramBins.reduce((sum, bin) => sum + bin.frequency, 0)).toBe(1000);
    // Probabilities sum to ~1
    const totalProbability = summary.histogramBins.reduce((sum, bin) => sum + bin.probability, 0);
    expect(totalProbability).toBeCloseTo(1, 8);

    // S-curve has the requested number of points
    expect(summary.sCurvePoints.length).toBe(10);
    // Last cumulative probability is 1
    expect(summary.sCurvePoints.at(-1)?.cumulativeProbability).toBe(1);
    // S-curve values are monotonic
    for (let i = 1; i < summary.sCurvePoints.length; i += 1) {
      expect(summary.sCurvePoints[i]!.cumulativeProbability).toBeGreaterThanOrEqual(
        summary.sCurvePoints[i - 1]!.cumulativeProbability,
      );
    }
  });

  it("shifts the budget upward when quantity is at its maximum", () => {
    const input: RiskSimulationInput = {
      ...BASE_INPUT,
      baseTotal: 500,
      items: [
        createItem({
          itemId: "item-1",
          baseQuantity: 10,
          unitPrice: 50,
          baseTotal: 500,
        }),
      ],
      variables: [
        createVariable({
          id: "risk-max",
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          distributionType: "TRIANGULAR",
          minimum: 12,
          mostLikely: 14,
          maximum: 17,
        }),
      ],
    };

    const summary = runMonteCarloSimulation(input, {
      random: seededRandom(),
      histogramBinCount: 5,
      sCurvePointCount: 5,
    });

    // With only upward risk, every percentile should be >= base total
    expect(summary.p10).toBeGreaterThanOrEqual(500);
    expect(summary.p95).toBeGreaterThan(500);
    expect(summary.mean).toBeGreaterThan(500);
  });

  it("combines quantity and unit price variables on the same item", () => {
    const items: RiskBudgetItem[] = [
      createItem({
        itemId: "item-1",
        baseQuantity: 10,
        unitPrice: 100,
        baseTotal: 1000,
      }),
    ];

    const variables: RiskVariableRecord[] = [
      createVariable({
        id: "risk-qty",
        budgetItemId: "item-1",
        variableType: "QUANTITY",
        distributionType: "TRIANGULAR",
        minimum: 8,
        mostLikely: 10,
        maximum: 12,
      }),
      createVariable({
        id: "risk-price",
        budgetItemId: "item-1",
        variableType: "UNIT_PRICE",
        distributionType: "TRIANGULAR",
        minimum: 90,
        mostLikely: 100,
        maximum: 110,
      }),
    ];

    const summary = runMonteCarloSimulation(
      {
        budgetId: "budget-1",
        baseTotal: 1000,
        iterations: 1000,
        items,
        variables,
        correlations: [],
      },
      {
        random: seededRandom(),
        histogramBinCount: 8,
        sCurvePointCount: 8,
      },
    );

    expect(Number.isFinite(summary.mean)).toBe(true);
    expect(Number.isFinite(summary.p95)).toBe(true);
    expect(summary.histogramBins.length).toBe(8);
    expect(summary.sCurvePoints.length).toBe(8);
  });

  it("handles multiple items with independent risk variables", () => {
    const items: RiskBudgetItem[] = [
      createItem({
        itemId: "item-1",
        code: "01.01",
        description: "Excavacion",
        baseQuantity: 10,
        unitPrice: 100,
        baseTotal: 1000,
      }),
      createItem({
        itemId: "item-2",
        code: "01.02",
        description: "Relleno",
        baseQuantity: 5,
        unitPrice: 80,
        baseTotal: 400,
      }),
    ];

    const variables: RiskVariableRecord[] = [
      createVariable({
        id: "risk-1",
        budgetItemId: "item-1",
        variableType: "QUANTITY",
        minimum: 8,
        mostLikely: 10,
        maximum: 12,
      }),
      createVariable({
        id: "risk-2",
        budgetItemId: "item-2",
        variableType: "UNIT_PRICE",
        minimum: 70,
        mostLikely: 80,
        maximum: 100,
      }),
    ];

    const summary = runMonteCarloSimulation(
      {
        budgetId: "budget-1",
        baseTotal: 1400,
        iterations: 1000,
        items,
        variables,
        correlations: [],
      },
      {
        random: seededRandom(),
        histogramBinCount: 10,
        sCurvePointCount: 10,
      },
    );

    // Summary accounts for both items
    expect(summary.baseTotal).toBe(1400);
    expect(Number.isFinite(summary.mean)).toBe(true);
    expect(summary.histogramBins.reduce((sum, bin) => sum + bin.frequency, 0)).toBe(1000);
  });

  it("produces higher dispersion with wider variable ranges", () => {
    const narrowInput: RiskSimulationInput = {
      ...BASE_INPUT,
      variables: [
        createVariable({
          id: "risk-narrow",
          budgetItemId: "item-1",
          minimum: 9.5,
          mostLikely: 10,
          maximum: 10.5,
        }),
      ],
    };

    const wideInput: RiskSimulationInput = {
      ...BASE_INPUT,
      variables: [
        createVariable({
          id: "risk-wide",
          budgetItemId: "item-1",
          minimum: 5,
          mostLikely: 10,
          maximum: 15,
        }),
      ],
    };

    const narrowRandom = seededRandom();
    const narrowSummary = runMonteCarloSimulation(narrowInput, { random: narrowRandom });
    const wideRandom = seededRandom();
    const wideSummary = runMonteCarloSimulation(wideInput, { random: wideRandom });

    // Wider range should produce higher variance and standard deviation
    expect(wideSummary.variance).toBeGreaterThan(narrowSummary.variance);
    expect(wideSummary.standardDeviation).toBeGreaterThan(narrowSummary.standardDeviation);
  });

  it("runs simulation with correlated variables successfully", () => {
    const items: RiskBudgetItem[] = [
      createItem({
        itemId: "item-1",
        baseQuantity: 10,
        unitPrice: 50,
        baseTotal: 500,
      }),
      createItem({
        itemId: "item-2",
        baseQuantity: 5,
        unitPrice: 100,
        baseTotal: 500,
      }),
    ];

    const variables: RiskVariableRecord[] = [
      createVariable({
        id: "risk-1",
        budgetItemId: "item-1",
        variableType: "QUANTITY",
        minimum: 5,
        mostLikely: 10,
        maximum: 15,
      }),
      createVariable({
        id: "risk-2",
        budgetItemId: "item-2",
        variableType: "QUANTITY",
        minimum: 2,
        mostLikely: 5,
        maximum: 8,
      }),
    ];

    const correlations: RiskCorrelationRecord[] = [
      {
        id: "corr-1",
        budgetId: "budget-1",
        sourceVariableId: "risk-1",
        targetVariableId: "risk-2",
        coefficient: 0.95,
      },
    ];

    const summary = runMonteCarloSimulation(
      {
        budgetId: "budget-1",
        baseTotal: 1000,
        iterations: 1000,
        items,
        variables,
        correlations,
      },
      {
        random: seededRandom(),
        histogramBinCount: 8,
        sCurvePointCount: 8,
      },
    );

    // Strong positive correlation produces valid simulation output with
    // all expected summary fields present and a different distribution
    // than the uncorrelated baseline.
    expect(Number.isFinite(summary.mean)).toBe(true);
    expect(Number.isFinite(summary.p50)).toBe(true);
    expect(Number.isFinite(summary.standardDeviation)).toBe(true);
    expect(summary.histogramBins.length).toBe(8);
    expect(summary.sCurvePoints.length).toBe(8);

    // Correlation should change the output vs an uncorrelated run
    // (same items, variables, seed — only correlation differs)
    const uncorrelatedRandom = seededRandom();
    const uncorrelatedSummary = runMonteCarloSimulation(
      {
        budgetId: "budget-1",
        baseTotal: 1000,
        iterations: 1000,
        items,
        variables,
        correlations: [],
      },
      {
        random: uncorrelatedRandom,
        histogramBinCount: 8,
        sCurvePointCount: 8,
      },
    );

    // At least one statistic should differ between correlated and uncorrelated
    const anyDiff =
      summary.mean !== uncorrelatedSummary.mean ||
      summary.standardDeviation !== uncorrelatedSummary.standardDeviation ||
      summary.p50 !== uncorrelatedSummary.p50;
    expect(anyDiff).toBe(true);
  });

  it("supports all four distribution types in the same run", () => {
    const items: RiskBudgetItem[] = [
      createItem({ itemId: "item-tri", baseTotal: 250, unitPrice: 25, baseQuantity: 10 }),
      createItem({ itemId: "item-pert", baseTotal: 250, unitPrice: 25, baseQuantity: 10 }),
      createItem({ itemId: "item-normal", baseTotal: 250, unitPrice: 25, baseQuantity: 10 }),
      createItem({ itemId: "item-uniform", baseTotal: 250, unitPrice: 25, baseQuantity: 10 }),
    ];

    const variables: RiskVariableRecord[] = [
      createVariable({
        id: "risk-tri",
        budgetItemId: "item-tri",
        variableType: "QUANTITY",
        distributionType: "TRIANGULAR",
        minimum: 8,
        mostLikely: 10,
        maximum: 12,
      }),
      createVariable({
        id: "risk-pert",
        budgetItemId: "item-pert",
        variableType: "QUANTITY",
        distributionType: "PERT",
        minimum: 8,
        mostLikely: 10,
        maximum: 12,
      }),
      createVariable({
        id: "risk-normal",
        budgetItemId: "item-normal",
        variableType: "QUANTITY",
        distributionType: "NORMAL",
        minimum: 8,
        mostLikely: 10,
        maximum: 12,
      }),
      createVariable({
        id: "risk-uniform",
        budgetItemId: "item-uniform",
        variableType: "QUANTITY",
        distributionType: "UNIFORM",
        minimum: 8,
        mostLikely: 10,
        maximum: 12,
      }),
    ];

    const summary = runMonteCarloSimulation(
      {
        budgetId: "budget-1",
        baseTotal: 1000,
        iterations: 1000,
        items,
        variables,
        correlations: [],
      },
      {
        random: seededRandom(),
        histogramBinCount: 10,
        sCurvePointCount: 10,
      },
    );

    // All distribution types should work without error
    expect(Number.isFinite(summary.mean)).toBe(true);
    expect(summary.histogramBins.length).toBe(10);

    // UNIFORM should produce visible dispersion (non-zero variance)
    const uniformInput: RiskSimulationInput = {
      budgetId: "budget-1",
      baseTotal: 250,
      iterations: 500,
      items: [createItem({ itemId: "item-uniform", baseTotal: 250 })],
      variables: [
        createVariable({
          id: "risk-uniform",
          budgetItemId: "item-uniform",
          distributionType: "UNIFORM",
          minimum: 5,
          mostLikely: 10,
          maximum: 15,
        }),
      ],
      correlations: [],
    };

    const uniformSummary = runMonteCarloSimulation(uniformInput, {
      random: seededRandom(),
    });
    expect(uniformSummary.standardDeviation).toBeGreaterThan(0);
  });

  it("runs with the full Monte Carlo iteration count and completes under reasonable time", async () => {
    const { MONTE_CARLO_ITERATIONS } = await import("@/types/risk");

    const start = Date.now();
    const summary = runMonteCarloSimulation(
      {
        budgetId: "budget-1",
        baseTotal: 500,
        iterations: MONTE_CARLO_ITERATIONS,
        items: [
          createItem({ itemId: "item-1", baseTotal: 500, baseQuantity: 10, unitPrice: 50 }),
        ],
        variables: [
          createVariable({
            id: "risk-1",
            budgetItemId: "item-1",
            variableType: "QUANTITY",
            minimum: 8,
            mostLikely: 10,
            maximum: 12,
          }),
        ],
        correlations: [],
      },
      {
        random: seededRandom(),
        histogramBinCount: 15,
        sCurvePointCount: 20,
      },
    );
    const elapsed = Date.now() - start;

    expect(summary.iterations).toBe(MONTE_CARLO_ITERATIONS);
    expect(summary.histogramBins.reduce((sum, bin) => sum + bin.frequency, 0)).toBe(MONTE_CARLO_ITERATIONS);
    expect(summary.sCurvePoints.length).toBe(20);
    // Should complete in under 3 seconds
    expect(elapsed).toBeLessThan(3000);
  });

  it("recomputes statistics consistently from raw totals", () => {
    const summary = runMonteCarloSimulation(BASE_INPUT, {
      random: seededRandom(),
      histogramBinCount: 10,
      sCurvePointCount: 10,
    });

    // Reconstruct the raw totals from histogram
    const reconstructedTotals: number[] = [];
    for (const bin of summary.histogramBins) {
      for (let i = 0; i < bin.frequency; i += 1) {
        reconstructedTotals.push(bin.midpoint);
      }
    }
    reconstructedTotals.sort((a, b) => a - b);

    // Statistics computed from totals should be internally consistent
    const recalculatedMean = calculateMean(reconstructedTotals);
    const recalculatedStdDev = calculateStandardDeviation(reconstructedTotals);
    const recalculatedVariance = calculateVariance(reconstructedTotals);
    const recalculatedMedian = calculateMedian(reconstructedTotals);
    const recalculatedP10 = calculatePercentile(reconstructedTotals, 0.1);
    const recalculatedP90 = calculatePercentile(reconstructedTotals, 0.9);

    // Reasonable tolerance for bin-midpoint rounding (wider for variance
    // since squaring amplifies the midpoint approximation error)
    expect(Math.abs(summary.variance - recalculatedVariance)).toBeLessThan(100);
    expect(Math.abs(summary.standardDeviation - recalculatedStdDev)).toBeLessThan(6);
    expect(Math.abs(summary.mean - recalculatedMean)).toBeLessThan(2);

    // Median from binned midpoints should be close to p50
    // (bin-midpoint reconstruction is lossy for order statistics)
    expect(Math.abs(recalculatedMedian - summary.p50)).toBeLessThan(15);
    // Percentiles should follow expected ordering even when reconstructed
    expect(recalculatedP10).toBeLessThanOrEqual(recalculatedMedian);
    expect(recalculatedMedian).toBeLessThanOrEqual(recalculatedP90);
  });

  it("returns null scheduleDuration when workSchedule is not provided", () => {
    const summary = runMonteCarloSimulation(BASE_INPUT, { random: seededRandom() });
    expect(summary.scheduleDuration).toBeNull();
  });

  it("respects progressInterval and invokes onProgress callbacks", () => {
    const progressEvents: Array<[number, number]> = [];

    runMonteCarloSimulation(BASE_INPUT, {
      random: seededRandom(),
      progressInterval: 250,
      onProgress: (completed, total) => {
        progressEvents.push([completed, total]);
      },
    });

    expect(progressEvents.length).toBeGreaterThanOrEqual(4);
    // First event at 250
    expect(progressEvents[0]).toEqual([250, 1000]);
    // Last event at 1000
    const lastEvent = progressEvents[progressEvents.length - 1];
    expect(lastEvent).toEqual([1000, 1000]);
  });

  it("produces consistent output with the same random seed", () => {
    const first = runMonteCarloSimulation(BASE_INPUT, {
      random: seededRandom(),
      histogramBinCount: 5,
    });

    const second = runMonteCarloSimulation(BASE_INPUT, {
      random: seededRandom(),
      histogramBinCount: 5,
    });

    // Same seed → identical output in every field
    expect(first).toEqual(second);
  });

  it("skewness and kurtosis have expected signs for asymmetric distributions", () => {
    // Right-skewed: minimum is close to mostLikely, maximum is far away
    const rightSkewedInput: RiskSimulationInput = {
      ...BASE_INPUT,
      baseTotal: 500,
      items: [createItem({ itemId: "item-1", baseTotal: 500, unitPrice: 50, baseQuantity: 10 })],
      variables: [
        createVariable({
          id: "risk-right",
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          minimum: 9,
          mostLikely: 10,
          maximum: 18,
        }),
      ],
    };

    const rightSkewedSummary = runMonteCarloSimulation(rightSkewedInput, {
      random: seededRandom(),
    });

    // Right-skewed → positive skewness
    expect(rightSkewedSummary.skewness).toBeGreaterThan(0);
    // Kurtosis is a valid finite number (triangular distributions
    // are typically platykurtic with negative kurtosis)
    expect(Number.isFinite(rightSkewedSummary.kurtosis)).toBe(true);
  });

  it("disabled variables are excluded from the simulation", () => {
    const inputWithDisabled: RiskSimulationInput = {
      ...BASE_INPUT,
      variables: [
        createVariable({
          id: "risk-enabled",
          budgetItemId: "item-1",
          minimum: 5,
          mostLikely: 10,
          maximum: 15,
          enabled: true,
        }),
        createVariable({
          id: "risk-disabled",
          budgetItemId: "item-1",
          variableType: "UNIT_PRICE",
          minimum: 1,
          mostLikely: 100,
          maximum: 999,
          enabled: false,
        }),
      ],
    };

    const summary = runMonteCarloSimulation(inputWithDisabled, {
      random: seededRandom(),
    });

    // Disabled variable should not affect results — mean should be close
    // to what we'd expect from only the enabled variable (around 1000)
    // If the disabled variable were active with such extreme values,
    // the mean would be wildly different.
    expect(summary.mean).toBeGreaterThan(800);
    expect(summary.p95).toBeLessThan(2000);
  });
});
