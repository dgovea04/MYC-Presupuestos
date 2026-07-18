import { describe, expect, it } from "vitest";
import { buildRiskPdfTables, createRiskAnalysisPdf } from "@/lib/risk/pdf-report";
import type { RiskAnalysisPayload } from "@/types/risk";

describe("risk pdf report", () => {
  it("builds the core report tables for a latest simulation", () => {
    const tables = buildRiskPdfTables(createPayload(), 2);

    expect(tables.map((table) => table.title)).toEqual([
      "Resumen ejecutivo",
      "Curva S acumulada",
      "Percentiles y contingencia",
      "Variables activas",
      "Histograma resumido",
      "Contingencia de plazo",
      "Buffer recomendado de plazo",
    ]);
    expect(tables[1]?.chart).toMatchObject({ kind: "curve" });
    expect(tables[3]?.rows[0]?.[3]).toBe("PERT");
    expect(tables[5]?.rows[0]).toEqual(["Media", "49.2 dias", "+3.2 dias", "6.96%"]);
    expect(tables[6]?.rows[0]).toEqual(["Buffer recomendado", "6.0 dias (13.04%)", "52.0 dias"]);
    expect(JSON.stringify(tables)).toContain("risk-engine-v2");
    expect(JSON.stringify(tables)).toContain("seed-1");
  });

  it("creates a non-empty pdf buffer", async () => {
    const pdf = await createRiskAnalysisPdf(createPayload(), 2);

    expect(pdf.byteLength).toBeGreaterThan(0);
  });
});

function createPayload(): RiskAnalysisPayload {
  return {
    budget: {
      id: "budget-1",
      projectId: "project-1",
      name: "Presupuesto General",
      kind: "GENERAL",
      currency: "PEN",
      baseTotal: 1000,
    },
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
        distributionType: "PERT",
        minimum: 8,
        mostLikely: 10,
        maximum: 12,
        enabled: true,
      },
    ],
    correlations: [],
    latestRun: {
      budgetId: "budget-1",
      iterations: 10000,
      baseTotal: 1000,
      mean: 1045,
      median: 1032,
      variance: 196,
      standardDeviation: 14,
      skewness: 0.25,
      kurtosis: -0.15,
      p10: 990,
      p50: 1032,
      p80: 1085,
      p90: 1102,
      p95: 1120,
      histogramBins: [
        { min: 980, max: 1000, midpoint: 990, frequency: 1000, probability: 0.1 },
        { min: 1000, max: 1040, midpoint: 1020, frequency: 4000, probability: 0.4 },
      ],
      sCurvePoints: [
        { cost: 990, cumulativeProbability: 0.1 },
        { cost: 1032, cumulativeProbability: 0.5 },
        { cost: 1120, cumulativeProbability: 0.95 },
      ],
      scheduleDuration: {
        iterations: 10000,
        baseProjectDurationDays: 46,
        meanDurationDays: 49.2,
        medianDurationDays: 49,
        p80DurationDays: 52,
        p90DurationDays: 54,
        p95DurationDays: 55,
        minimumDurationDays: 46,
        maximumDurationDays: 60,
        criticalItemCount: 2,
        histogramBins: [
          { min: 46, max: 48, midpoint: 47, frequency: 1200, probability: 0.12 },
          { min: 48, max: 50, midpoint: 49, frequency: 3800, probability: 0.38 },
        ],
        sCurvePoints: [
          { cost: 46, cumulativeProbability: 0.05 },
          { cost: 49, cumulativeProbability: 0.5 },
          { cost: 55, cumulativeProbability: 0.95 },
        ],
      },
      scenarioId: "scenario-1",
      seed: "seed-1",
      engineVersion: "risk-engine-v2",
      modelSnapshot: {
        budgetId: "budget-1",
        scenarioId: "scenario-1",
        itemIds: ["item-1"],
        variableIds: ["risk-1"],
        correlationIds: [],
        seed: "seed-1",
        engineVersion: "risk-engine-v2",
      },
      createdAt: "2026-07-01T00:00:00.000Z",
    },
  };
}
