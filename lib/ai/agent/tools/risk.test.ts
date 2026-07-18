import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentToolContext } from "../types";
import type { RiskAnalysisPayload, RiskSimulationSummary } from "@/types/risk";

const mocks = vi.hoisted(() => ({
  getRiskAnalysisPayload: vi.fn(),
  suggestRiskVariables: vi.fn(),
  saveRiskScenario: vi.fn(),
  runAndSaveRiskSimulation: vi.fn(),
}));

vi.mock("@/lib/risk/data", () => ({
  getRiskAnalysisPayload: mocks.getRiskAnalysisPayload,
}));

vi.mock("@/lib/risk/suggestions", () => ({
  suggestRiskVariables: mocks.suggestRiskVariables,
}));

vi.mock("@/lib/risk/scenarios", () => ({
  saveRiskScenario: mocks.saveRiskScenario,
}));

vi.mock("@/lib/risk/simulation-service", () => ({
  runAndSaveRiskSimulation: mocks.runAndSaveRiskSimulation,
}));

vi.mock("@/lib/data/budgets", () => ({
  getBudgetById: vi.fn(),
  saveBudgetPatch: vi.fn(),
}));

vi.mock("@/lib/data/work-schedule", () => ({
  generateWorkScheduleBase: vi.fn(),
  getWorkScheduleSection: vi.fn(),
  previewWorkScheduleBase: vi.fn(),
  saveWorkScheduleItemPatch: vi.fn(),
}));

vi.mock("@/lib/data/metrados", () => ({
  createMetradoSheet: vi.fn(),
  duplicateMetradoSheet: vi.fn(),
  getMetradoSheetById: vi.fn(),
  listMetradoTemplates: vi.fn(),
}));

vi.mock("@/lib/metrados/validation", () => ({
  hasBlockingMetradoIssues: vi.fn(),
  validateMetradoSheet: vi.fn(),
}));

vi.mock("@/lib/work-schedule/critical-path", () => ({
  calculateWorkScheduleCriticalPath: vi.fn(),
}));

vi.mock("@/lib/exports/excel", () => ({
  createApuWorkbook: vi.fn(),
  createBudgetWorkbook: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    budgetItem: { findFirst: vi.fn() },
  },
}));

vi.mock("./budgets", () => ({ budgetTools: [] }));
vi.mock("./partidas", () => ({ partidaTools: [] }));
vi.mock("./apu", () => ({ apuTools: [] }));
vi.mock("./insumos", () => ({ insumoTools: [] }));
vi.mock("./projects", () => ({ projectTools: [] }));
vi.mock("./mcp-budget", () => ({ mcpBudgetTools: [] }));

import { agentToolMetadata } from "../tool-metadata";
import { allTools, riskTools } from "./index";
import {
  getRiskAnalysisTool,
  runRiskSimulationTool,
  saveRiskScenarioTool,
  summarizeRiskSimulationTool,
} from "./risk";

function makeContext(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    userId: "user-1",
    executionId: "execution-1",
    ...overrides,
  };
}

function makePayload(latestRun: RiskSimulationSummary | null = null): RiskAnalysisPayload {
  return {
    budget: {
      id: "budget-1",
      projectId: "project-1",
      name: "Obra prueba",
      kind: "SUB_BUDGET",
      currency: "PEN",
      baseTotal: 1000,
    },
    items: [],
    variables: [],
    correlations: [],
    latestRun,
  };
}

function makeLatestRun(): RiskSimulationSummary {
  return {
    id: "run-1",
    budgetId: "budget-1",
    scenarioId: "scenario-1",
    iterations: 10000,
    baseTotal: 1000,
    mean: 1100,
    median: 1080,
    variance: 100,
    standardDeviation: 10,
    skewness: 0.1,
    kurtosis: 0.2,
    p10: 950,
    p50: 1080,
    p80: 1150,
    p90: 1200,
    p95: 1250,
    histogramBins: [
      {
        min: 900,
        max: 1000,
        midpoint: 950,
        frequency: 120,
        probability: 0.12,
      },
    ],
    sCurvePoints: [{ cost: 1150, cumulativeProbability: 0.8 }],
    scheduleDuration: null,
    seed: "seed-1",
    engineVersion: "risk-engine-v2",
    modelSnapshot: null,
    createdAt: "2026-07-18T00:00:00.000Z",
  };
}

describe("risk agent tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports and registers the six risk tools in the required order", () => {
    const expectedNames = [
      "getRiskAnalysis",
      "suggestRiskVariables",
      "previewRiskScenario",
      "saveRiskScenario",
      "runRiskSimulation",
      "summarizeRiskSimulation",
    ];

    expect(riskTools.map((tool) => tool.name)).toEqual(expectedNames);
    expect(expectedNames.every((name) => allTools.some((tool) => tool.name === name))).toBe(true);
  });

  it("marks only scenario save and simulation run as financial risk", () => {
    const riskByName = new Map(riskTools.map((tool) => [tool.name, tool.risk]));

    expect(riskByName).toEqual(
      new Map([
        ["getRiskAnalysis", "read"],
        ["suggestRiskVariables", "read"],
        ["previewRiskScenario", "read"],
        ["saveRiskScenario", "financial"],
        ["runRiskSimulation", "financial"],
        ["summarizeRiskSimulation", "read"],
      ]),
    );
  });

  it("exposes metadata for the six risk tools", () => {
    const riskMetadata = agentToolMetadata.filter((metadata) =>
      riskTools.some((tool) => tool.name === metadata.name),
    );

    expect(riskMetadata.map((metadata) => metadata.name)).toEqual(riskTools.map((tool) => tool.name));
    expect(riskMetadata.map((metadata) => metadata.risk)).toEqual(riskTools.map((tool) => tool.risk));
  });

  it("loads risk analysis for the current user", async () => {
    const payload = makePayload();
    mocks.getRiskAnalysisPayload.mockResolvedValueOnce(payload);

    const result = await getRiskAnalysisTool.execute({ budgetId: "budget-1" }, makeContext());

    expect(result).toBe(payload);
    expect(mocks.getRiskAnalysisPayload).toHaveBeenCalledWith("budget-1", "user-1");
  });

  it("saves approved risk scenarios through the scenario service", async () => {
    const scenario = {
      id: "scenario-1",
      budgetId: "budget-1",
      name: "Escenario Khipu",
      description: null,
      source: "AGENT",
      status: "APPROVED",
      createdByUserId: "user-1",
      createdAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z",
    };
    mocks.saveRiskScenario.mockResolvedValueOnce(scenario);

    const result = await saveRiskScenarioTool.execute(
      {
        budgetId: "budget-1",
        name: "Escenario Khipu",
        variables: [
          {
            budgetItemId: "item-1",
            variableType: "QUANTITY",
            distributionType: "PERT",
            minimum: 9,
            mostLikely: 10,
            maximum: 11,
            enabled: true,
          },
        ],
        correlations: [],
      },
      makeContext(),
    );

    expect(result).toBe(scenario);
    expect(mocks.saveRiskScenario).toHaveBeenCalledWith(
      "budget-1",
      "user-1",
      expect.objectContaining({
        source: "AGENT",
        status: "APPROVED",
      }),
    );
  });

  it("runs and saves a real risk simulation through the server runner", async () => {
    const latestRun = makeLatestRun();
    mocks.runAndSaveRiskSimulation.mockResolvedValueOnce(latestRun);

    const result = await runRiskSimulationTool.execute(
      { budgetId: "budget-1", scenarioId: "scenario-1", seed: "seed-1" },
      makeContext(),
    );

    expect(result).toBe(latestRun);
    expect(mocks.runAndSaveRiskSimulation).toHaveBeenCalledWith(
      "budget-1",
      "user-1",
      { budgetId: "budget-1", scenarioId: "scenario-1", seed: "seed-1" },
    );
  });

  it("summarizes only real latest run data", async () => {
    const latestRun = makeLatestRun();
    mocks.getRiskAnalysisPayload.mockResolvedValueOnce(makePayload(latestRun));

    const result = await summarizeRiskSimulationTool.execute(
      { budgetId: "budget-1" },
      makeContext(),
    );

    expect(result).toEqual({
      budget: expect.objectContaining({ id: "budget-1" }),
      latestRun,
      hasSimulation: true,
    });
  });

  it("does not invent simulation statistics when no latest run exists", async () => {
    mocks.getRiskAnalysisPayload.mockResolvedValueOnce(makePayload(null));

    const result = await summarizeRiskSimulationTool.execute(
      { budgetId: "budget-1" },
      makeContext(),
    );

    expect(result).toEqual({
      budget: expect.objectContaining({ id: "budget-1" }),
      latestRun: null,
      hasSimulation: false,
      message: "No existe una simulacion vigente para este presupuesto.",
    });
  });
});
