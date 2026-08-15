/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getRiskAnalysisPayload, normalizeRiskBudgetItems, saveRiskCorrelations, saveRiskSimulationRun } from "@/lib/risk/data";
import { MONTE_CARLO_ITERATIONS } from "@/types/risk";
import {
  riskCorrelationInputSchema,
  riskSimulationRunInputSchema,
  riskVariableSuggestionSchema,
  riskVariableInputSchema,
} from "@/lib/validations/risk";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    budget: {
      findFirst: vi.fn() as any,
      findMany: vi.fn() as any,
    },
    riskVariable: {
      findMany: vi.fn() as any,
    },
    riskCorrelation: {
      findMany: vi.fn() as any,
      upsert: vi.fn() as any,
      deleteMany: vi.fn() as any,
    },
    riskSimulationRun: {
      create: vi.fn() as any,
      findFirst: vi.fn() as any,
    },
    $transaction: vi.fn(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma as unknown as typeof prisma)),
  },
}));

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

  it("accepts a valid unit price triangular variable", () => {
    const parsed = riskVariableInputSchema.parse({
      id: "risk-2",
      budgetItemId: "item-1",
      variableType: "UNIT_PRICE",
      distributionType: "TRIANGULAR",
      minimum: 20,
      mostLikely: 25,
      maximum: 30,
      enabled: true,
    });

    expect(parsed).toEqual({
      id: "risk-2",
      budgetItemId: "item-1",
      variableType: "UNIT_PRICE",
      distributionType: "TRIANGULAR",
      minimum: 20,
      mostLikely: 25,
      maximum: 30,
      enabled: true,
    });
  });

  it("accepts a valid PERT variable", () => {
    const parsed = riskVariableInputSchema.parse({
      id: "risk-3",
      budgetItemId: "item-1",
      variableType: "QUANTITY",
      distributionType: "PERT",
      minimum: 18,
      mostLikely: 20,
      maximum: 24,
      enabled: true,
    });

    expect(parsed).toEqual({
      id: "risk-3",
      budgetItemId: "item-1",
      variableType: "QUANTITY",
      distributionType: "PERT",
      minimum: 18,
      mostLikely: 20,
      maximum: 24,
      enabled: true,
    });
  });

  it("accepts a valid NORMAL variable", () => {
    const parsed = riskVariableInputSchema.parse({
      id: "risk-4",
      budgetItemId: "item-1",
      variableType: "UNIT_PRICE",
      distributionType: "NORMAL",
      minimum: 95,
      mostLikely: 100,
      maximum: 110,
      enabled: true,
    });

    expect(parsed).toEqual({
      id: "risk-4",
      budgetItemId: "item-1",
      variableType: "UNIT_PRICE",
      distributionType: "NORMAL",
      minimum: 95,
      mostLikely: 100,
      maximum: 110,
      enabled: true,
    });
  });

  it("accepts a valid UNIFORM variable", () => {
    const parsed = riskVariableInputSchema.parse({
      id: "risk-5",
      budgetItemId: "item-1",
      variableType: "QUANTITY",
      distributionType: "UNIFORM",
      minimum: 8,
      mostLikely: 10,
      maximum: 12,
      enabled: true,
    });

    expect(parsed).toEqual({
      id: "risk-5",
      budgetItemId: "item-1",
      variableType: "QUANTITY",
      distributionType: "UNIFORM",
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

  it("accepts a valid correlation pair", () => {
    const parsed = riskCorrelationInputSchema.parse({
      sourceVariableId: "risk-1",
      targetVariableId: "risk-2",
      coefficient: 0.65,
    });

    expect(parsed).toEqual({
      sourceVariableId: "risk-1",
      targetVariableId: "risk-2",
      coefficient: 0.65,
    });
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

  it("validates a risk variable suggestion", () => {
    const parsed = riskVariableSuggestionSchema.parse({
      id: "suggestion-1",
      budgetId: "budget-1",
      budgetItemId: "item-1",
      itemCode: "01.01",
      itemDescription: "Excavación manual",
      sourceBudgetName: "Estructuras",
      variableType: "QUANTITY",
      distributionType: "PERT",
      minimum: 9.5,
      mostLikely: 10,
      maximum: 11,
      confidence: 0.82,
      reason: "Partida de alto impacto con metrado sensible.",
      source: "HEURISTIC",
      impactScore: 1200,
    });

    expect(parsed.confidence).toBe(0.82);
  });

  it("rejects a risk variable suggestion with inverted range", () => {
    expect(() =>
      riskVariableSuggestionSchema.parse({
        id: "suggestion-1",
        budgetId: "budget-1",
        budgetItemId: "item-1",
        variableType: "QUANTITY",
        distributionType: "PERT",
        minimum: 12,
        mostLikely: 10,
        maximum: 11,
        confidence: 0.82,
        reason: "Rango invalido.",
        source: "HEURISTIC",
        impactScore: 1200,
      }),
    ).toThrow();
  });

  it("does not accept client-computed simulation totals when saving a run", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.mocked(prisma.budget.findFirst).mockResolvedValueOnce({
      ...baseBudget,
      id: "budget-1",
      projectId: "project-1",
      kind: "SUB_BUDGET",
      name: "Estructuras",
      items: [createBudgetItem({ id: "item-1", budgetId: "budget-1" })],
    } as any);
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-1", budgetItemId: "item-1" }),
    ]);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.create).mockImplementationOnce(((args: any) => ({
      ...createRiskRun({ id: "run-1", budgetId: "budget-1" }),
      ...args.data,
      createdAt: baseDate,
    })) as any);

    const summary = await saveRiskSimulationRun("budget-1", "user-1", {
      ...validRunInput,
      baseTotal: 1,
      p95: 999_999_999,
    } as any);

    expect(summary.baseTotal).toBe(250);
    expect(summary.p95).not.toBe(999_999_999);
    expect(prisma.riskSimulationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          baseTotal: 250,
        }),
      }),
    );
  });

  it("limits general budget scope to child sub-budgets from the same project", () => {
    const items = normalizeRiskBudgetItems({
      ...baseBudget,
      id: "general-1",
      projectId: "project-1",
      kind: "GENERAL",
      name: "Presupuesto general",
      items: [createBudgetItem({ id: "general-item", budgetId: "general-1" })],
      childBudgets: [
        {
          ...baseBudget,
          id: "sub-1",
          projectId: "project-1",
          parentBudgetId: "general-1",
          kind: "SUB_BUDGET",
          name: "Estructuras",
          items: [createBudgetItem({ id: "allowed-item", budgetId: "sub-1" })],
        },
        {
          ...baseBudget,
          id: "general-child",
          projectId: "project-1",
          parentBudgetId: "general-1",
          kind: "GENERAL",
          name: "General anidado",
          items: [createBudgetItem({ id: "wrong-kind-item", budgetId: "general-child" })],
        },
        {
          ...baseBudget,
          id: "foreign-sub",
          projectId: "project-2",
          parentBudgetId: "general-1",
          kind: "SUB_BUDGET",
          name: "Proyecto externo",
          items: [createBudgetItem({ id: "wrong-project-item", budgetId: "foreign-sub" })],
        },
      ],
    } as any);

    expect(items.map((item) => item.itemId)).toEqual(["allowed-item"]);
    expect(items[0]).toMatchObject({
      budgetId: "sub-1",
      sourceBudgetName: "Estructuras",
    });
  });

  it("serializes only variables attached to scoped risk items", async () => {
    vi.mocked(prisma.budget.findFirst).mockResolvedValueOnce({
      ...baseBudget,
      id: "general-1",
      projectId: "project-1",
      kind: "GENERAL",
      name: "Presupuesto general",
      items: [],
      childBudgets: [],
    } as any);
    vi.mocked(prisma.budget.findMany).mockResolvedValueOnce([
      {
        ...baseBudget,
        id: "sub-1",
        projectId: "project-1",
        parentBudgetId: "general-1",
        kind: "SUB_BUDGET",
        name: "Estructuras",
        items: [createBudgetItem({ id: "allowed-item", budgetId: "sub-1" })],
      } as any,
    ]);
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      createRiskVariable({ id: "risk-allowed", budgetItemId: "allowed-item" }),
      createRiskVariable({ id: "risk-stale", budgetItemId: "stale-item" }),
    ]);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    const payload = await getRiskAnalysisPayload("general-1", "user-1");

    expect(prisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          parentBudgetId: "general-1",
          kind: "SUB_BUDGET",
          projectId: "project-1",
        }),
      }),
    );
    expect(prisma.riskVariable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          budgetId: "general-1",
          budgetItemId: { in: ["allowed-item"] },
        }),
      }),
    );
    expect(payload.variables.map((variable) => variable.id)).toEqual(["risk-allowed"]);
    expect(payload.correlations).toEqual([]);
  });

  it("hides the latest run when risk variables changed after it was created", async () => {
    vi.mocked(prisma.budget.findFirst).mockResolvedValueOnce({
      ...baseBudget,
      id: "budget-1",
      projectId: "project-1",
      kind: "SUB_BUDGET",
      name: "Estructuras",
      items: [createBudgetItem({ id: "item-1", budgetId: "budget-1" })],
    } as any);
    vi.mocked(prisma.riskVariable.findMany).mockResolvedValueOnce([
      {
        ...createRiskVariable({ id: "risk-1", budgetItemId: "item-1" }),
        updatedAt: new Date("2026-05-26T10:00:00.000Z"),
      },
    ]);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(
      createRiskRun({
        id: "stale-run",
        budgetId: "budget-1",
        createdAt: new Date("2026-05-26T09:00:00.000Z"),
      }),
    );

    const payload = await getRiskAnalysisPayload("budget-1", "user-1");

    expect(payload.latestRun).toBeNull();
  });

  it("normalizes and saves correlation pairs using canonical variable order", async () => {
    vi.mocked(prisma.budget.findFirst).mockResolvedValue({
      ...baseBudget,
      id: "budget-1",
      projectId: "project-1",
      kind: "SUB_BUDGET",
      name: "Estructuras",
      items: [createBudgetItem({ id: "item-1", budgetId: "budget-1" }), createBudgetItem({ id: "item-2", budgetId: "budget-1" })],
    } as any);
    vi.mocked(prisma.riskVariable.findMany)
      .mockResolvedValueOnce([
        createRiskVariable({ id: "risk-2", budgetItemId: "item-2" }),
        createRiskVariable({ id: "risk-1", budgetItemId: "item-1" }),
      ])
      .mockResolvedValueOnce([
        createRiskVariable({ id: "risk-1", budgetItemId: "item-1" }),
        createRiskVariable({ id: "risk-2", budgetItemId: "item-2" }),
      ]);
    vi.mocked(prisma.riskCorrelation.upsert).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.riskCorrelation.findMany).mockResolvedValueOnce([
      createRiskCorrelation({ sourceVariableId: "risk-1", targetVariableId: "risk-2" }),
    ] as any);
    vi.mocked(prisma.riskSimulationRun.findFirst).mockResolvedValueOnce(null);

    const payload = await saveRiskCorrelations("budget-1", "user-1", {
      correlations: [{ sourceVariableId: "risk-2", targetVariableId: "risk-1", coefficient: 0.4 }],
    });

    expect(prisma.riskCorrelation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          budgetId_sourceVariableId_targetVariableId: {
            budgetId: "budget-1",
            sourceVariableId: "risk-1",
            targetVariableId: "risk-2",
          },
        },
      }),
    );
    expect(payload.correlations[0]).toMatchObject({
      sourceVariableId: "risk-1",
      targetVariableId: "risk-2",
      coefficient: 0.4,
    });
  });
});

const validRunInput = {
  budgetId: "budget-1",
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
  scheduleDuration: null,
};

const decimalZero = new Prisma.Decimal(0);
const baseDate = new Date("2026-05-26T00:00:00.000Z");

const baseBudget = {
  id: "budget-1",
  projectId: "project-1",
  parentBudgetId: null as string | null,
  kind: "SUB_BUDGET" as const,
  name: "Base",
  currency: "PEN",
  igvRate: decimalZero,
  generalExpensesRate: decimalZero,
  utilityRate: decimalZero,
  totalDirectCost: decimalZero,
  totalGeneralExpenses: decimalZero,
  totalUtility: decimalZero,
  totalTax: decimalZero,
  totalAmount: decimalZero,
  createdAt: baseDate,
  updatedAt: baseDate,
};

function createBudgetItem({ id, budgetId }: { id: string; budgetId: string }) {
  return {
    id,
    budgetId,
    levelId: null,
    code: "01.01",
    description: "Excavacion",
    unit: "m3",
    quantity: new Prisma.Decimal(10),
    unitPrice: new Prisma.Decimal(25),
    partial: new Prisma.Decimal(250),
    sortOrder: 0,
    createdAt: baseDate,
    updatedAt: baseDate,
  };
}

function createRiskVariable({ id, budgetItemId }: { id: string; budgetItemId: string }) {
  return {
    id,
    budgetId: "general-1",
    budgetItemId,
    variableType: "QUANTITY" as const,
    distributionType: "TRIANGULAR" as const,
    minimum: new Prisma.Decimal(8),
    mostLikely: new Prisma.Decimal(10),
    maximum: new Prisma.Decimal(12),
    enabled: true,
    createdAt: baseDate,
    updatedAt: baseDate,
  };
}

function createRiskCorrelation({
  sourceVariableId,
  targetVariableId,
}: {
  sourceVariableId: string;
  targetVariableId: string;
}) {
  return {
    id: "corr-1",
    budgetId: "budget-1",
    sourceVariableId,
    targetVariableId,
    coefficient: new Prisma.Decimal(0.4),
    createdAt: baseDate,
    updatedAt: baseDate,
  };
}

function createRiskRun({
  budgetId,
  createdAt = baseDate,
  id,
}: {
  budgetId: string;
  createdAt?: Date;
  id: string;
}) {
  return {
    id,
    budgetId,
    budget: null as any,
    iterations: MONTE_CARLO_ITERATIONS,
    baseTotal: new Prisma.Decimal(250),
    mean: new Prisma.Decimal(250),
    median: new Prisma.Decimal(250),
    variance: new Prisma.Decimal(0),
    standardDeviation: new Prisma.Decimal(0),
    skewness: new Prisma.Decimal(0),
    kurtosis: new Prisma.Decimal(0),
    p10: new Prisma.Decimal(250),
    p50: new Prisma.Decimal(250),
    p80: new Prisma.Decimal(250),
    p90: new Prisma.Decimal(250),
    p95: new Prisma.Decimal(250),
    histogramBins: [
      {
        min: 250,
        max: 250,
        midpoint: 250,
        frequency: MONTE_CARLO_ITERATIONS,
        probability: 1,
      },
    ],
    sCurvePoints: [
      {
        cost: 250,
        cumulativeProbability: 1,
      },
    ],
    scheduleSummary: null,
    createdAt,
  };
}
