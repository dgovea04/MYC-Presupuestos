import { describe, expect, it } from "vitest";
import {
  buildBoxPlotStats,
  buildTornadoSensitivity,
  buildHistogram,
  buildSCurve,
  calculateKurtosis,
  calculateMean,
  calculatePercentile,
  calculateSkewness,
  calculateStandardDeviation,
  calculateVariance,
} from "@/lib/risk/statistics";
import {
  buildCorrelationMatrix,
  buildCorrelatedUniformSampler,
  createSeededRandom,
  runMonteCarloSimulation,
  sampleNormal,
  samplePert,
  sampleTriangular,
  sampleUniform,
} from "@/lib/risk/monte-carlo-engine";
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

  it("builds tornado sensitivity rows ordered by impact", () => {
    const sensitivity = buildTornadoSensitivity(
      [
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
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
        {
          itemId: "item-2",
          budgetId: "child-1",
          sourceBudgetName: "Estructuras",
          code: "01.02",
          description: "Relleno",
          unit: "m3",
          baseQuantity: 5,
          unitPrice: 80,
          baseTotal: 400,
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
      [
        {
          id: "risk-1",
          budgetId: "budget-1",
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          distributionType: "TRIANGULAR",
          minimum: 8,
          mostLikely: 10,
          maximum: 14,
          enabled: true,
        },
        {
          id: "risk-2",
          budgetId: "budget-1",
          budgetItemId: "item-2",
          variableType: "QUANTITY",
          distributionType: "TRIANGULAR",
          minimum: 4,
          mostLikely: 5,
          maximum: 6,
          enabled: true,
        },
      ],
      1400,
    );

    expect(sensitivity).toHaveLength(2);
    expect(sensitivity[0]).toMatchObject({
      itemId: "item-1",
      label: "Cant. 01.01 Excavacion",
      lowDelta: -200,
      highDelta: 400,
      impact: 400,
    });
    expect(sensitivity[1]).toMatchObject({
      itemId: "item-2",
      impact: 80,
    });
  });

  it("derives box plot stats from a simulation summary", () => {
    const boxPlot = buildBoxPlotStats({
      budgetId: "budget-1",
      iterations: 10000,
      baseTotal: 1000,
      mean: 1030,
      median: 1020,
      variance: 400,
      standardDeviation: 20,
      skewness: 0.1,
      kurtosis: -0.2,
      p10: 980,
      p50: 1020,
      p80: 1060,
      p90: 1080,
      p95: 1100,
      histogramBins: [
        { min: 950, max: 980, midpoint: 965, frequency: 20, probability: 0.2 },
        { min: 980, max: 1010, midpoint: 995, frequency: 30, probability: 0.3 },
        { min: 1010, max: 1040, midpoint: 1025, frequency: 30, probability: 0.3 },
        { min: 1040, max: 1100, midpoint: 1070, frequency: 20, probability: 0.2 },
      ],
      sCurvePoints: [
        { cost: 950, cumulativeProbability: 0.01 },
        { cost: 990, cumulativeProbability: 0.25 },
        { cost: 1020, cumulativeProbability: 0.5 },
        { cost: 1055, cumulativeProbability: 0.75 },
        { cost: 1100, cumulativeProbability: 0.99 },
      ],
      scheduleDuration: null,
    });

    expect(boxPlot).toEqual({
      minimum: 950,
      lowerQuartile: 990,
      median: 1020,
      upperQuartile: 1055,
      maximum: 1100,
    });
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
        updatedAt: "2026-07-01T00:00:00.000Z",
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
    correlations: [],
  };

  it("samples triangular values inside the configured range", () => {
    const value = sampleTriangular({ minimum: 10, mostLikely: 15, maximum: 20 }, () => 0.5);
    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThanOrEqual(20);
  });

  it("rejects invalid triangular ranges", () => {
    expect(() => sampleTriangular({ minimum: 20, mostLikely: 15, maximum: 10 }, () => 0.5)).toThrow("triangular");
  });

  it("samples PERT values inside the configured range", () => {
    const sequence = createRandomSequence([0.31, 0.72, 0.44, 0.28, 0.63, 0.54, 0.17, 0.81, 0.49]);
    const value = samplePert({ minimum: 10, mostLikely: 15, maximum: 20 }, sequence);

    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThanOrEqual(20);
  });

  it("samples uniform values inside the configured range", () => {
    const value = sampleUniform({ minimum: 10, mostLikely: 15, maximum: 20 }, () => 0.25);

    expect(value).toBe(12.5);
  });

  it("samples normal values inside the configured range", () => {
    const value = sampleNormal({ minimum: 10, mostLikely: 15, maximum: 20 }, () => 0.5);

    expect(value).toBe(15);
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

  it("produces deterministic summaries when a seed is provided", () => {
    const first = runMonteCarloSimulation(baseSimulationInput, { seed: "risk-seed-1" });
    const second = runMonteCarloSimulation(baseSimulationInput, { seed: "risk-seed-1" });

    expect(first.p80).toBe(second.p80);
    expect(first.histogramBins).toEqual(second.histogramBins);
  });

  it("creates repeatable seeded random sequences", () => {
    const first = createSeededRandom("risk-seed-1");
    const second = createSeededRandom("risk-seed-1");

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it("simulates unit price variables using the same triangular distribution", () => {
    const summary = runMonteCarloSimulation(
      {
        ...baseSimulationInput,
        baseTotal: 500,
        items: [
          {
            itemId: "item-1",
            budgetId: "child-1",
            sourceBudgetName: "Estructuras",
            code: "01.01",
            description: "Excavacion",
            unit: "m3",
            baseQuantity: 10,
            unitPrice: 50,
            baseTotal: 500,
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ],
        variables: [
          {
            id: "price-risk-1",
            budgetId: "budget-1",
            budgetItemId: "item-1",
            variableType: "UNIT_PRICE",
            distributionType: "TRIANGULAR",
            minimum: 40,
            mostLikely: 50,
            maximum: 70,
            enabled: true,
          } as unknown as RiskVariableRecord,
        ],
      },
      { random: () => 1 },
    );

    expect(summary.mean).toBe(700);
    expect(summary.p95).toBe(700);
  });

  it("supports PERT variables in the simulation engine", () => {
    const summary = runMonteCarloSimulation(
      {
        ...baseSimulationInput,
        baseTotal: 550,
        items: [
          {
            itemId: "item-1",
            budgetId: "child-1",
            sourceBudgetName: "Estructuras",
            code: "01.01",
            description: "Excavacion",
            unit: "m3",
            baseQuantity: 10,
            unitPrice: 55,
            baseTotal: 550,
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ],
        variables: [
          {
            id: "pert-risk-1",
            budgetId: "budget-1",
            budgetItemId: "item-1",
            variableType: "UNIT_PRICE",
            distributionType: "PERT",
            minimum: 55,
            mostLikely: 55,
            maximum: 55,
            enabled: true,
          },
        ],
        correlations: [],
      },
      { random: () => 0.5 },
    );

    expect(summary.mean).toBe(550);
    expect(summary.p95).toBe(550);
  });

  it("supports UNIFORM variables in the simulation engine", () => {
    const summary = runMonteCarloSimulation(
      {
        ...baseSimulationInput,
        baseTotal: 500,
        items: [
          {
            itemId: "item-1",
            budgetId: "child-1",
            sourceBudgetName: "Estructuras",
            code: "01.01",
            description: "Excavacion",
            unit: "m3",
            baseQuantity: 10,
            unitPrice: 50,
            baseTotal: 500,
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ],
        variables: [
          {
            id: "uniform-risk-1",
            budgetId: "budget-1",
            budgetItemId: "item-1",
            variableType: "UNIT_PRICE",
            distributionType: "UNIFORM",
            minimum: 40,
            mostLikely: 50,
            maximum: 60,
            enabled: true,
          },
        ],
        correlations: [],
      },
      { random: () => 0.5 },
    );

    expect(summary.mean).toBe(500);
    expect(summary.p95).toBe(500);
  });

  it("supports NORMAL variables in the simulation engine", () => {
    const summary = runMonteCarloSimulation(
      {
        ...baseSimulationInput,
        baseTotal: 500,
        items: [
          {
            itemId: "item-1",
            budgetId: "child-1",
            sourceBudgetName: "Estructuras",
            code: "01.01",
            description: "Excavacion",
            unit: "m3",
            baseQuantity: 10,
            unitPrice: 50,
            baseTotal: 500,
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ],
        variables: [
          {
            id: "normal-risk-1",
            budgetId: "budget-1",
            budgetItemId: "item-1",
            variableType: "UNIT_PRICE",
            distributionType: "NORMAL",
            minimum: 40,
            mostLikely: 50,
            maximum: 60,
            enabled: true,
          },
        ],
        correlations: [],
      },
      { random: () => 0.5 },
    );

    expect(summary.mean).toBe(500);
    expect(summary.p95).toBe(500);
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

  it("accepts duration variables without changing the simulated cost summary", () => {
    const summary = runMonteCarloSimulation(
      {
        ...baseSimulationInput,
        variables: [
          {
            ...baseSimulationInput.variables[0],
            id: "duration-risk-1",
            variableType: "DURATION",
            minimum: 7,
            mostLikely: 10,
            maximum: 14,
          },
        ],
      },
      { random: () => 1 },
    );

    expect(summary.mean).toBe(1000);
    expect(summary.p95).toBe(1000);
    expect(summary.scheduleDuration).toBeNull();
  });

  it("simulates project duration percentiles when the run includes duration variables and a schedule", () => {
    const summary = runMonteCarloSimulation(
      {
        ...baseSimulationInput,
        variables: [
          {
            id: "duration-risk-1",
            budgetId: "budget-1",
            budgetItemId: "item-1",
            variableType: "DURATION",
            distributionType: "TRIANGULAR",
            minimum: 5,
            mostLikely: 5,
            maximum: 5,
            enabled: true,
          },
        ],
        workSchedule: {
          lines: [
            {
              budgetItemId: "item-1",
              itemCode: "01.01",
              description: "Excavacion",
              durationDays: 5,
              predecessor: null,
              subBudgetName: "Estructuras",
            },
            {
              budgetItemId: "item-2",
              itemCode: "01.02",
              description: "Relleno",
              durationDays: 3,
              predecessor: "01.01FS",
              subBudgetName: "Estructuras",
            },
          ],
        },
      },
      { random: () => 0.5 },
    );

    expect(summary.scheduleDuration).toEqual({
      iterations: 4,
      baseProjectDurationDays: 8,
      meanDurationDays: 8,
      medianDurationDays: 8,
      p80DurationDays: 8,
      p90DurationDays: 8,
      p95DurationDays: 8,
      minimumDurationDays: 8,
      maximumDurationDays: 8,
      criticalItemCount: 2,
      histogramBins: [{ min: 8, max: 8, midpoint: 8, frequency: 4, probability: 1 }],
      sCurvePoints: [
        { cost: 8, cumulativeProbability: 0.25 },
        { cost: 8, cumulativeProbability: 0.5 },
        { cost: 8, cumulativeProbability: 0.75 },
        { cost: 8, cumulativeProbability: 1 },
      ],
    });
  });

  it("rejects unsupported enabled distributions", () => {
    const unsupportedType = {
      ...baseSimulationInput.variables[0],
      variableType: "NORMAL",
    } as unknown as RiskVariableRecord;
    const unsupportedDistribution = {
      ...baseSimulationInput.variables[0],
      distributionType: "LOGNORMAL",
    } as unknown as RiskVariableRecord;

    expect(() =>
      runMonteCarloSimulation({ ...baseSimulationInput, variables: [unsupportedType] }, { random: () => 0.5 }),
    ).toThrow("Unsupported risk variable type");
    expect(() =>
      runMonteCarloSimulation({ ...baseSimulationInput, variables: [unsupportedDistribution] }, { random: () => 0.5 }),
    ).toThrow("Unsupported risk distribution type");
  });

  it("builds a symmetric correlation matrix from saved pairs", () => {
    const matrix = buildCorrelationMatrix(
      [
        { ...baseSimulationInput.variables[0], id: "risk-1" },
        { ...baseSimulationInput.variables[0], id: "risk-2", budgetItemId: "item-1", variableType: "UNIT_PRICE" },
      ],
      [
        {
          id: "corr-1",
          budgetId: "budget-1",
          sourceVariableId: "risk-1",
          targetVariableId: "risk-2",
          coefficient: 0.45,
        },
      ],
    );

    expect(matrix).toEqual([
      [1, 0.45],
      [0.45, 1],
    ]);
  });

  it("maps correlated normals into uniform draws for paired variables", () => {
    const sampler = buildCorrelatedUniformSampler(
      [
        { ...baseSimulationInput.variables[0], id: "risk-1" },
        { ...baseSimulationInput.variables[0], id: "risk-2", budgetItemId: "item-1", variableType: "UNIT_PRICE" },
      ],
      [
        {
          id: "corr-1",
          budgetId: "budget-1",
          sourceVariableId: "risk-1",
          targetVariableId: "risk-2",
          coefficient: 0.6,
        },
      ],
      createRandomSequence([0.19, 0.61, 0.27, 0.83]),
    );

    const draws = sampler();

    expect(draws).toHaveLength(2);
    expect(draws.every((value) => value > 0 && value < 1)).toBe(true);
    expect(Math.abs(draws[0]! - draws[1]!)).toBeLessThan(0.35);
  });
});

function createRandomSequence(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index] ?? values.at(-1) ?? 0.5;
    index += 1;
    return value;
  };
}
