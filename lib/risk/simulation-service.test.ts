import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createRunMock,
  getPayloadMock,
  riskCorrelationFindManyMock,
  riskScenarioFindFirstMock,
  riskVariableFindManyMock,
} = vi.hoisted(() => ({
  createRunMock: vi.fn(),
  getPayloadMock: vi.fn(),
  riskCorrelationFindManyMock: vi.fn(),
  riskScenarioFindFirstMock: vi.fn(),
  riskVariableFindManyMock: vi.fn(),
}));

vi.mock("@/lib/risk/data", () => ({
  getRiskAnalysisPayload: getPayloadMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    riskScenario: {
      findFirst: riskScenarioFindFirstMock,
    },
    riskVariable: {
      findMany: riskVariableFindManyMock,
    },
    riskCorrelation: {
      findMany: riskCorrelationFindManyMock,
    },
    riskSimulationRun: {
      create: createRunMock,
    },
  },
}));

import {
  buildRiskSimulationSnapshot,
  RISK_ENGINE_VERSION,
  runAndSaveRiskSimulation,
} from "@/lib/risk/simulation-service";

describe("buildRiskSimulationSnapshot", () => {
  it("captures ids and engine metadata for audit", () => {
    const snapshot = buildRiskSimulationSnapshot({
      budgetId: "budget-1",
      scenarioId: "scenario-1",
      baseTotal: 1000,
      iterations: 10000,
      seed: "seed-1",
      engineVersion: "risk-engine-v2",
      itemIds: ["item-1"],
      variableIds: ["risk-1"],
      correlationIds: ["corr-1"],
      createdAt: "2026-07-17T00:00:00.000Z",
    });

    expect(snapshot).toMatchObject({
      budgetId: "budget-1",
      scenarioId: "scenario-1",
      seed: "seed-1",
      engineVersion: "risk-engine-v2",
    });
  });
});

describe("runAndSaveRiskSimulation", () => {
  beforeEach(() => {
    createRunMock.mockReset();
    getPayloadMock.mockReset();
    riskCorrelationFindManyMock.mockReset();
    riskScenarioFindFirstMock.mockReset();
    riskVariableFindManyMock.mockReset();
  });

  it("requires server-side run requests to match the selected budget", async () => {
    await expect(
      runAndSaveRiskSimulation("budget-1", "user-1", { budgetId: "other-budget" }),
    ).rejects.toThrow("no corresponde");
  });

  it("rejects scenario ids outside the selected budget before creating a run", async () => {
    riskScenarioFindFirstMock.mockResolvedValue(null);

    await expect(
      runAndSaveRiskSimulation("budget-1", "user-1", {
        budgetId: "budget-1",
        scenarioId: "scenario-other-budget",
      }),
    ).rejects.toThrow("El escenario de riesgo no corresponde al presupuesto seleccionado.");

    expect(riskScenarioFindFirstMock).toHaveBeenCalledWith({
      where: { id: "scenario-other-budget", budgetId: "budget-1" },
    });
    expect(getPayloadMock).not.toHaveBeenCalled();
    expect(riskVariableFindManyMock).not.toHaveBeenCalled();
    expect(riskCorrelationFindManyMock).not.toHaveBeenCalled();
    expect(createRunMock).not.toHaveBeenCalled();
  });

  it("loads risk data server-side, runs with seed, and persists audit metadata", async () => {
    riskScenarioFindFirstMock.mockResolvedValue(createRiskScenario());
    getPayloadMock.mockResolvedValue(createPayload());
    riskVariableFindManyMock.mockResolvedValue([createRiskVariable()]);
    riskCorrelationFindManyMock.mockResolvedValue([]);
    createRunMock.mockImplementation((args: { data: Record<string, unknown> }) => createPersistedRun(args.data));

    const result = await runAndSaveRiskSimulation("budget-1", "user-1", {
      budgetId: "budget-1",
      scenarioId: "scenario-1",
      seed: "seed-1",
    });

    expect(riskVariableFindManyMock).toHaveBeenCalledWith({
      where: {
        budgetId: "budget-1",
        scenarioId: "scenario-1",
        budgetItemId: { in: ["item-1"] },
      },
      orderBy: { createdAt: "asc" },
    });
    expect(createRunMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        budgetId: "budget-1",
        scenarioId: "scenario-1",
        createdByUserId: "user-1",
        seed: "seed-1",
        engineVersion: RISK_ENGINE_VERSION,
        modelSnapshot: expect.objectContaining({
          budgetId: "budget-1",
          scenarioId: "scenario-1",
          itemIds: ["item-1"],
          variableIds: ["risk-1"],
          correlationIds: [],
        }),
      }),
    });
    expect(result).toMatchObject({
      id: "run-1",
      budgetId: "budget-1",
      scenarioId: "scenario-1",
      seed: "seed-1",
      engineVersion: RISK_ENGINE_VERSION,
      modelSnapshot: expect.objectContaining({ variableIds: ["risk-1"] }),
    });
  });
});

function createPayload() {
  return {
    budget: {
      id: "budget-1",
      projectId: "project-1",
      name: "Obra",
      kind: "SUB_BUDGET",
      currency: "PEN",
      baseTotal: 1000,
    },
    items: [
      {
        itemId: "item-1",
        budgetId: "budget-1",
        sourceBudgetName: "Estructuras",
        code: "01.01",
        description: "Excavacion",
        unit: "m3",
        baseQuantity: 10,
        unitPrice: 100,
        baseTotal: 1000,
        updatedAt: "2026-07-17T00:00:00.000Z",
      },
    ],
    variables: [],
    correlations: [],
    latestRun: null,
  };
}

function createRiskVariable() {
  return {
    id: "risk-1",
    budgetId: "budget-1",
    scenarioId: "scenario-1",
    budgetItemId: "item-1",
    variableType: "QUANTITY",
    distributionType: "TRIANGULAR",
    minimum: new Prisma.Decimal(8),
    mostLikely: new Prisma.Decimal(10),
    maximum: new Prisma.Decimal(12),
    enabled: true,
    source: "AGENT",
    confidence: new Prisma.Decimal("0.8"),
    rationale: "Partida sensible.",
    createdAt: new Date("2026-07-17T00:00:00.000Z"),
    updatedAt: new Date("2026-07-17T00:00:00.000Z"),
  };
}

function createRiskScenario() {
  return {
    id: "scenario-1",
    budgetId: "budget-1",
    name: "Escenario base",
    description: null,
    createdByUserId: "user-1",
    createdAt: new Date("2026-07-17T00:00:00.000Z"),
    updatedAt: new Date("2026-07-17T00:00:00.000Z"),
  };
}

function createPersistedRun(data: Record<string, unknown>) {
  return {
    id: "run-1",
    budgetId: data.budgetId,
    scenarioId: data.scenarioId,
    createdByUserId: data.createdByUserId,
    iterations: data.iterations,
    seed: data.seed,
    engineVersion: data.engineVersion,
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
    modelSnapshot: data.modelSnapshot,
    createdAt: new Date("2026-07-17T00:00:00.000Z"),
  };
}
