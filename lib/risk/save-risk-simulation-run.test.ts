import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    budget: {
      findFirst: findFirstMock,
    },
    riskSimulationRun: {
      create: createMock,
    },
  },
}));

import { saveRiskSimulationRun } from "@/lib/risk/data";
import type { RiskSimulationRunInput } from "@/lib/validations/risk";
import { MONTE_CARLO_ITERATIONS, type RiskSimulationSummary } from "@/types/risk";

describe("saveRiskSimulationRun", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    createMock.mockReset();
  });

  it("persists the provided simulation summary without recalculating it", async () => {
    findFirstMock.mockResolvedValue({
      id: "budget-1",
      projectId: "project-1",
      kind: "SUB_BUDGET",
      name: "Subpresupuesto 1",
      currency: "PEN",
      items: [],
    });
    createMock.mockResolvedValue(createPersistedRun());

    const summary: RiskSimulationSummary = {
      budgetId: "budget-1",
      iterations: MONTE_CARLO_ITERATIONS,
      baseTotal: 1000,
      mean: 1035,
      median: 1030,
      variance: 225.1234,
      standardDeviation: 15.0042,
      skewness: 0.222,
      kurtosis: -0.111,
      p10: 980,
      p50: 1030,
      p80: 1080,
      p90: 1100,
      p95: 1120,
      histogramBins: [{ min: 980, max: 1020, midpoint: 1000, frequency: 2500, probability: 0.25 }],
      sCurvePoints: [
        { cost: 980, cumulativeProbability: 0.1 },
        { cost: 1030, cumulativeProbability: 0.5 },
        { cost: 1120, cumulativeProbability: 0.95 },
      ],
      scheduleDuration: {
        iterations: MONTE_CARLO_ITERATIONS,
        baseProjectDurationDays: 90,
        meanDurationDays: 95,
        medianDurationDays: 94,
        p80DurationDays: 100,
        p90DurationDays: 105,
        p95DurationDays: 110,
        minimumDurationDays: 80,
        maximumDurationDays: 120,
        criticalItemCount: 5,
        histogramBins: [{ min: 80, max: 90, midpoint: 85, frequency: 2000, probability: 0.2 }],
        sCurvePoints: [
          { cost: 80, cumulativeProbability: 0.05 },
          { cost: 95, cumulativeProbability: 0.5 },
          { cost: 120, cumulativeProbability: 1 },
        ],
      },
    };

    const result = await saveRiskSimulationRun("budget-1", "user-1", summary as unknown as RiskSimulationRunInput);

    expect(createMock).toHaveBeenCalledWith({
      data: {
        budgetId: "budget-1",
        iterations: MONTE_CARLO_ITERATIONS,
        baseTotal: 1000,
        mean: 1035,
        median: 1030,
        variance: 225.1234,
        standardDeviation: 15.0042,
        skewness: 0.222,
        kurtosis: -0.111,
        p10: 980,
        p50: 1030,
        p80: 1080,
        p90: 1100,
        p95: 1120,
        histogramBins: summary.histogramBins,
        sCurvePoints: summary.sCurvePoints,
        scheduleSummary: summary.scheduleDuration,
      },
    });
    expect(result).toMatchObject({
      id: "run-1",
      budgetId: "budget-1",
      p50: 1030,
      scheduleDuration: {
        baseProjectDurationDays: 90,
        criticalItemCount: 5,
      },
    });
  });
});

function createPersistedRun() {
  return {
    id: "run-1",
    budgetId: "budget-1",
    iterations: MONTE_CARLO_ITERATIONS,
    baseTotal: new Prisma.Decimal(1000),
    mean: new Prisma.Decimal(1035),
    median: new Prisma.Decimal(1030),
    variance: new Prisma.Decimal(225.1234),
    standardDeviation: new Prisma.Decimal(15.0042),
    skewness: new Prisma.Decimal(0.222),
    kurtosis: new Prisma.Decimal(-0.111),
    p10: new Prisma.Decimal(980),
    p50: new Prisma.Decimal(1030),
    p80: new Prisma.Decimal(1080),
    p90: new Prisma.Decimal(1100),
    p95: new Prisma.Decimal(1120),
    histogramBins: [{ min: 980, max: 1020, midpoint: 1000, frequency: 2500, probability: 0.25 }],
    sCurvePoints: [
      { cost: 980, cumulativeProbability: 0.1 },
      { cost: 1030, cumulativeProbability: 0.5 },
      { cost: 1120, cumulativeProbability: 0.95 },
    ],
    scheduleSummary: {
      iterations: MONTE_CARLO_ITERATIONS,
      baseProjectDurationDays: 90,
      meanDurationDays: 95,
      medianDurationDays: 94,
      p80DurationDays: 100,
      p90DurationDays: 105,
      p95DurationDays: 110,
      minimumDurationDays: 80,
      maximumDurationDays: 120,
      criticalItemCount: 5,
      histogramBins: [{ min: 80, max: 90, midpoint: 85, frequency: 2000, probability: 0.2 }],
      sCurvePoints: [
        { cost: 80, cumulativeProbability: 0.05 },
        { cost: 95, cumulativeProbability: 0.5 },
        { cost: 120, cumulativeProbability: 1 },
      ],
    },
    createdAt: new Date("2026-07-02T00:00:00.000Z"),
  };
}
