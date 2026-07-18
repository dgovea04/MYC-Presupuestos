import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, findFirstMock, riskCorrelationFindManyMock, riskVariableFindManyMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  createMock: vi.fn(),
  riskCorrelationFindManyMock: vi.fn(),
  riskVariableFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    budget: {
      findFirst: findFirstMock,
    },
    riskSimulationRun: {
      create: createMock,
    },
    riskVariable: {
      findMany: riskVariableFindManyMock,
    },
    riskCorrelation: {
      findMany: riskCorrelationFindManyMock,
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
    riskCorrelationFindManyMock.mockReset();
    riskVariableFindManyMock.mockReset();
  });

  it("persists a server-recalculated simulation summary instead of client totals", async () => {
    findFirstMock.mockResolvedValue({
      id: "budget-1",
      projectId: "project-1",
      kind: "SUB_BUDGET",
      name: "Subpresupuesto 1",
      currency: "PEN",
      items: [createBudgetItem()],
    });
    riskVariableFindManyMock.mockResolvedValue([]);
    riskCorrelationFindManyMock.mockResolvedValue([]);
    createMock.mockImplementation((args: { data: Record<string, unknown> }) => createPersistedRun(args.data));

    const summary: RiskSimulationSummary = {
      budgetId: "budget-1",
      iterations: MONTE_CARLO_ITERATIONS,
      baseTotal: 1,
      mean: 999_999,
      median: 999_999,
      variance: 999_999,
      standardDeviation: 999_999,
      skewness: 0.222,
      kurtosis: -0.111,
      p10: 999_999,
      p50: 999_999,
      p80: 999_999,
      p90: 999_999,
      p95: 999_999,
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
        baseTotal: 250,
        mean: 250,
        median: 250,
        variance: 0,
        standardDeviation: 0,
        skewness: 0,
        kurtosis: 0,
        p10: 250,
        p50: 250,
        p80: 250,
        p90: 250,
        p95: 250,
        histogramBins: [{ min: 250, max: 250, midpoint: 250, frequency: MONTE_CARLO_ITERATIONS, probability: 1 }],
        sCurvePoints: expect.any(Array),
        scheduleSummary: summary.scheduleDuration,
      },
    });
    expect(result).toMatchObject({
      id: "run-1",
      budgetId: "budget-1",
      baseTotal: 250,
      p50: 250,
      scheduleDuration: {
        baseProjectDurationDays: 90,
        criticalItemCount: 5,
      },
    });
  });
});

function createBudgetItem() {
  return {
    id: "item-1",
    budgetId: "budget-1",
    code: "01.01",
    description: "Excavacion",
    unit: "m3",
    quantity: new Prisma.Decimal(10),
    unitPrice: new Prisma.Decimal(25),
    sortOrder: 0,
    updatedAt: new Date("2026-07-02T00:00:00.000Z"),
  };
}

function createPersistedRun(data: Record<string, unknown>) {
  return {
    id: "run-1",
    budgetId: data.budgetId,
    iterations: data.iterations,
    baseTotal: new Prisma.Decimal(String(data.baseTotal)),
    mean: new Prisma.Decimal(String(data.mean)),
    median: new Prisma.Decimal(String(data.median)),
    variance: new Prisma.Decimal(String(data.variance)),
    standardDeviation: new Prisma.Decimal(String(data.standardDeviation)),
    skewness: new Prisma.Decimal(String(data.skewness)),
    kurtosis: new Prisma.Decimal(String(data.kurtosis)),
    p10: new Prisma.Decimal(String(data.p10)),
    p50: new Prisma.Decimal(String(data.p50)),
    p80: new Prisma.Decimal(String(data.p80)),
    p90: new Prisma.Decimal(String(data.p90)),
    p95: new Prisma.Decimal(String(data.p95)),
    histogramBins: data.histogramBins,
    sCurvePoints: data.sCurvePoints,
    scheduleSummary: data.scheduleSummary,
    createdAt: new Date("2026-07-02T00:00:00.000Z"),
  };
}
