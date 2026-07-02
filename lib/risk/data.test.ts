/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getRiskAnalysisFallbackData } from "@/lib/risk/data";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    riskVariable: {
      findMany: vi.fn() as any,
    },
    riskCorrelation: {
      findMany: vi.fn() as any,
    },
    riskSimulationRun: {
      findFirst: vi.fn() as any,
    },
  },
}));

const baseDate = new Date("2026-07-01T00:00:00.000Z");

function createRiskVariable(overrides: Partial<{
  id: string;
  budgetId: string;
  budgetItemId: string;
  variableType: string;
  distributionType: string;
  minimum: Prisma.Decimal;
  mostLikely: Prisma.Decimal;
  maximum: Prisma.Decimal;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "risk-1",
    budgetId: overrides.budgetId ?? "budget-1",
    budgetItemId: overrides.budgetItemId ?? "item-1",
    variableType: (overrides.variableType ?? "QUANTITY") as any,
    distributionType: (overrides.distributionType ?? "TRIANGULAR") as any,
    minimum: overrides.minimum ?? new Prisma.Decimal(8),
    mostLikely: overrides.mostLikely ?? new Prisma.Decimal(10),
    maximum: overrides.maximum ?? new Prisma.Decimal(12),
    enabled: overrides.enabled ?? true,
    createdAt: overrides.createdAt ?? baseDate,
    updatedAt: overrides.updatedAt ?? baseDate,
  };
}

function createRiskCorrelation(overrides: Partial<{
  id: string;
  budgetId: string;
  sourceVariableId: string;
  targetVariableId: string;
  coefficient: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "corr-1",
    budgetId: overrides.budgetId ?? "budget-1",
    sourceVariableId: overrides.sourceVariableId ?? "risk-1",
    targetVariableId: overrides.targetVariableId ?? "risk-2",
    coefficient: overrides.coefficient ?? new Prisma.Decimal(0.65),
    createdAt: overrides.createdAt ?? baseDate,
    updatedAt: overrides.updatedAt ?? baseDate,
  };
}

function createRiskRun(overrides: Partial<{
  id: string;
  budgetId: string;
  iterations: number;
  baseTotal: Prisma.Decimal;
  mean: Prisma.Decimal;
  median: Prisma.Decimal;
  variance: Prisma.Decimal;
  standardDeviation: Prisma.Decimal;
  skewness: Prisma.Decimal;
  kurtosis: Prisma.Decimal;
  p10: Prisma.Decimal;
  p50: Prisma.Decimal;
  p80: Prisma.Decimal;
  p90: Prisma.Decimal;
  p95: Prisma.Decimal;
  histogramBins: any;
  sCurvePoints: any;
  scheduleSummary: any;
  createdAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "run-1",
    budgetId: overrides.budgetId ?? "budget-1",
    iterations: overrides.iterations ?? 10000,
    baseTotal: overrides.baseTotal ?? new Prisma.Decimal(250),
    mean: overrides.mean ?? new Prisma.Decimal(260),
    median: overrides.median ?? new Prisma.Decimal(258),
    variance: overrides.variance ?? new Prisma.Decimal(400),
    standardDeviation: overrides.standardDeviation ?? new Prisma.Decimal(20),
    skewness: overrides.skewness ?? new Prisma.Decimal(0.1),
    kurtosis: overrides.kurtosis ?? new Prisma.Decimal(2.9),
    p10: overrides.p10 ?? new Prisma.Decimal(230),
    p50: overrides.p50 ?? new Prisma.Decimal(258),
    p80: overrides.p80 ?? new Prisma.Decimal(275),
    p90: overrides.p90 ?? new Prisma.Decimal(285),
    p95: overrides.p95 ?? new Prisma.Decimal(295),
    histogramBins: overrides.histogramBins ?? [
      { min: 200, max: 220, midpoint: 210, frequency: 500, probability: 0.05 },
      { min: 220, max: 240, midpoint: 230, frequency: 2000, probability: 0.2 },
      { min: 240, max: 260, midpoint: 250, frequency: 5000, probability: 0.5 },
      { min: 260, max: 280, midpoint: 270, frequency: 2000, probability: 0.2 },
      { min: 280, max: 300, midpoint: 290, frequency: 500, probability: 0.05 },
    ],
    sCurvePoints: overrides.sCurvePoints ?? [
      { cost: 200, cumulativeProbability: 0 },
      { cost: 250, cumulativeProbability: 0.5 },
      { cost: 300, cumulativeProbability: 0.95 },
      { cost: 350, cumulativeProbability: 1 },
    ],
    scheduleSummary: overrides.scheduleSummary ?? null,
    createdAt: overrides.createdAt ?? baseDate,
  };
}

describe("getRiskAnalysisFallbackData", () => {
  it("returns empty variables, correlations, and null latestRun when no risk data exists", async () => {
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1", "item-2"]);

    expect(result).toEqual({
      variables: [],
      correlations: [],
      latestRun: null,
    });
  });

  it("returns serialized variables filtered by scopedItemIds", async () => {
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-1", budgetItemId: "item-1" }),
      createRiskVariable({ id: "risk-2", budgetItemId: "item-2" }),
    ] as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1", "item-2"]);

    expect(result.variables).toHaveLength(2);
    expect(result.variables[0]).toMatchObject({
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

  it("excludes variables whose budgetItemId is not in scopedItemIds", async () => {
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-allowed", budgetItemId: "item-1" }),
      createRiskVariable({ id: "risk-excluded", budgetItemId: "item-3" }),
    ] as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1", "item-2"]);

    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].id).toBe("risk-allowed");
  });

  it("serializes all variable types (QUANTITY, UNIT_PRICE, DURATION)", async () => {
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-qty", budgetItemId: "item-1", variableType: "QUANTITY" }),
      createRiskVariable({ id: "risk-price", budgetItemId: "item-1", variableType: "UNIT_PRICE" }),
      createRiskVariable({ id: "risk-dur", budgetItemId: "item-1", variableType: "DURATION" }),
    ] as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1"]);

    expect(result.variables).toHaveLength(3);
    expect(result.variables.map((v) => v.variableType)).toEqual(["QUANTITY", "UNIT_PRICE", "DURATION"]);
  });

  it("serializes all distribution types (TRIANGULAR, PERT, NORMAL, UNIFORM)", async () => {
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-tri", budgetItemId: "item-1", distributionType: "TRIANGULAR" }),
      createRiskVariable({ id: "risk-pert", budgetItemId: "item-1", distributionType: "PERT" }),
      createRiskVariable({ id: "risk-norm", budgetItemId: "item-1", distributionType: "NORMAL" }),
      createRiskVariable({ id: "risk-unif", budgetItemId: "item-1", distributionType: "UNIFORM" }),
    ] as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1"]);

    expect(result.variables).toHaveLength(4);
    expect(result.variables.map((v) => v.distributionType)).toEqual([
      "TRIANGULAR",
      "PERT",
      "NORMAL",
      "UNIFORM",
    ]);
  });

  it("returns serialized correlations for existing variables", async () => {
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-1", budgetItemId: "item-1" }),
      createRiskVariable({ id: "risk-2", budgetItemId: "item-2" }),
    ] as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([
      createRiskCorrelation({
        id: "corr-1",
        sourceVariableId: "risk-1",
        targetVariableId: "risk-2",
        coefficient: new Prisma.Decimal(0.75),
      }),
    ] as any);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1", "item-2"]);

    expect(result.correlations).toHaveLength(1);
    expect(result.correlations[0]).toMatchObject({
      id: "corr-1",
      sourceVariableId: "risk-1",
      targetVariableId: "risk-2",
      coefficient: 0.75,
    });
  });

  it("filters out correlations where source variable doesn't exist in scope", async () => {
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-1", budgetItemId: "item-1" }),
    ] as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([
      createRiskCorrelation({
        sourceVariableId: "risk-orphan",
        targetVariableId: "risk-1",
      }),
    ] as any);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1"]);

    expect(result.correlations).toHaveLength(0);
  });

  it("filters out correlations where target variable doesn't exist in scope", async () => {
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-1", budgetItemId: "item-1" }),
    ] as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([
      createRiskCorrelation({
        sourceVariableId: "risk-1",
        targetVariableId: "risk-orphan",
      }),
    ] as any);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1"]);

    expect(result.correlations).toHaveLength(0);
  });

  it("returns latestRun when it exists and is newer than variable changes", async () => {
    const runDate = new Date("2026-07-02T00:00:00.000Z");
    const varDate = new Date("2026-07-01T00:00:00.000Z");

    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-1", budgetItemId: "item-1", updatedAt: varDate }),
    ] as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(
      createRiskRun({ id: "run-1", createdAt: runDate }) as any,
    );

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1"]);

    expect(result.latestRun).not.toBeNull();
    expect(result.latestRun!.id).toBe("run-1");
  });

  it("nullifies latestRun when variables changed after run creation", async () => {
    const runDate = new Date("2026-07-01T00:00:00.000Z");
    const varDate = new Date("2026-07-02T00:00:00.000Z");

    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-1", budgetItemId: "item-1", updatedAt: varDate }),
    ] as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(
      createRiskRun({ id: "stale-run", createdAt: runDate }) as any,
    );

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1"]);

    expect(result.latestRun).toBeNull();
  });

  it("nullifies latestRun when correlations changed after run creation", async () => {
    const runDate = new Date("2026-07-01T00:00:00.000Z");
    const corrDate = new Date("2026-07-02T00:00:00.000Z");

    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-1", budgetItemId: "item-1", updatedAt: runDate }),
      createRiskVariable({ id: "risk-2", budgetItemId: "item-2", updatedAt: runDate }),
    ] as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([
      createRiskCorrelation({
        sourceVariableId: "risk-1",
        targetVariableId: "risk-2",
        updatedAt: corrDate,
      }),
    ] as any);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(
      createRiskRun({ id: "stale-run", createdAt: runDate }) as any,
    );

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1", "item-2"]);

    expect(result.latestRun).toBeNull();
  });

  it("returns latestRun when only items changed (fallback uses variable-only invalidation)", async () => {
    // In fallback mode, items are NOT considered for model changed at — only variables
    // and correlations matter. This test verifies that a run is still returned even
    // if items would have been newer (which isn't tracked in the fallback path).
    const runDate = new Date("2026-07-02T00:00:00.000Z");
    const varDate = new Date("2026-07-01T00:00:00.000Z");

    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-1", budgetItemId: "item-1", updatedAt: varDate }),
    ] as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(
      createRiskRun({ id: "run-1", createdAt: runDate }) as any,
    );

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1"]);

    // The run is newer than variable changes, so it should be returned.
    // Items are not part of the fallback invalidation (they have epoch dates).
    expect(result.latestRun).not.toBeNull();
    expect(result.latestRun!.id).toBe("run-1");
  });

  it("handles empty scopedItemIds gracefully", async () => {
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    const result = await getRiskAnalysisFallbackData("budget-1", []);

    expect(result.variables).toEqual([]);
    expect(result.correlations).toEqual([]);
    expect(result.latestRun).toBeNull();
  });

  it("returns latestRun even when scopedItemIds is empty but a run exists", async () => {
    const runDate = new Date("2026-07-02T00:00:00.000Z");

    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(
      createRiskRun({ id: "run-1", createdAt: runDate }) as any,
    );

    const result = await getRiskAnalysisFallbackData("budget-1", []);

    expect(result.latestRun).not.toBeNull();
    expect(result.latestRun!.id).toBe("run-1");
  });

  it("serializes latestRun with full statistics", async () => {
    const runDate = new Date("2026-07-02T00:00:00.000Z");

    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(
      createRiskRun({
        id: "run-1",
        createdAt: runDate,
        baseTotal: new Prisma.Decimal(1000),
        mean: new Prisma.Decimal(1050),
        median: new Prisma.Decimal(1045),
        variance: new Prisma.Decimal(2500),
        standardDeviation: new Prisma.Decimal(50),
        skewness: new Prisma.Decimal(0.3),
        kurtosis: new Prisma.Decimal(3.2),
        p10: new Prisma.Decimal(980),
        p50: new Prisma.Decimal(1045),
        p80: new Prisma.Decimal(1090),
        p90: new Prisma.Decimal(1120),
        p95: new Prisma.Decimal(1145),
      }) as any,
    );

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1"]);

    expect(result.latestRun).toMatchObject({
      id: "run-1",
      baseTotal: 1000,
      mean: 1050,
      median: 1045,
      variance: 2500,
      standardDeviation: 50,
      skewness: 0.3,
      kurtosis: 3.2,
      p10: 980,
      p50: 1045,
      p80: 1090,
      p90: 1120,
      p95: 1145,
    });
  });

  it("serializes histogram bins and sCurve points from latestRun", async () => {
    const runDate = new Date("2026-07-02T00:00:00.000Z");

    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(
      createRiskRun({ id: "run-1", createdAt: runDate }) as any,
    );

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1"]);

    expect(result.latestRun!.histogramBins).toHaveLength(5);
    expect(result.latestRun!.histogramBins[0]).toMatchObject({
      min: 200,
      max: 220,
      midpoint: 210,
      frequency: 500,
      probability: 0.05,
    });
    expect(result.latestRun!.sCurvePoints).toHaveLength(4);
    expect(result.latestRun!.sCurvePoints[1]).toMatchObject({
      cost: 250,
      cumulativeProbability: 0.5,
    });
  });

  it("passes correct query parameters to Prisma for variable scoping", async () => {
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    await getRiskAnalysisFallbackData("budget-xyz", ["item-a", "item-b"]);

    expect(prisma.riskVariable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          budgetId: "budget-xyz",
          budgetItemId: { in: ["item-a", "item-b"] },
        }),
        orderBy: { createdAt: "asc" },
      }),
    );
    expect(prisma.riskCorrelation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { budgetId: "budget-xyz" },
        orderBy: { createdAt: "asc" },
      }),
    );
    expect(prisma.riskSimulationRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { budgetId: "budget-xyz" },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("returns disabled variables as-is (filtering happens in the simulation engine)", async () => {
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-enabled", budgetItemId: "item-1", enabled: true }),
      createRiskVariable({ id: "risk-disabled", budgetItemId: "item-1", enabled: false }),
    ] as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1"]);

    expect(result.variables).toHaveLength(2);
    const disabledVar = result.variables.find((v) => v.id === "risk-disabled");
    expect(disabledVar).toBeDefined();
    expect(disabledVar!.enabled).toBe(false);
  });

  it("serializes scheduleSummary when present in latestRun", async () => {
    const runDate = new Date("2026-07-02T00:00:00.000Z");

    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(
      createRiskRun({
        id: "run-1",
        createdAt: runDate,
        scheduleSummary: {
          iterations: 10000,
          baseProjectDurationDays: 90,
          meanDurationDays: 95,
          medianDurationDays: 94,
          p80DurationDays: 100,
          p90DurationDays: 105,
          p95DurationDays: 110,
          minimumDurationDays: 80,
          maximumDurationDays: 120,
          criticalItemCount: 5,
          histogramBins: [
            { min: 80, max: 90, midpoint: 85, frequency: 2000, probability: 0.2 },
          ],
          sCurvePoints: [
            { cost: 80, cumulativeProbability: 0 },
            { cost: 95, cumulativeProbability: 0.5 },
            { cost: 120, cumulativeProbability: 1 },
          ],
        },
      }) as any,
    );

    const result = await getRiskAnalysisFallbackData("budget-1", ["item-1"]);

    expect(result.latestRun!.scheduleDuration).toMatchObject({
      iterations: 10000,
      baseProjectDurationDays: 90,
      meanDurationDays: 95,
      medianDurationDays: 94,
      p80DurationDays: 100,
      p90DurationDays: 105,
      p95DurationDays: 110,
      minimumDurationDays: 80,
      maximumDurationDays: 120,
      criticalItemCount: 5,
    });
    expect(result.latestRun!.scheduleDuration!.histogramBins).toHaveLength(1);
    expect(result.latestRun!.scheduleDuration!.sCurvePoints).toHaveLength(3);
  });
});
