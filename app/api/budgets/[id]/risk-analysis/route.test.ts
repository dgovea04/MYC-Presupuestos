/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getRiskAnalysisPayload, normalizeRiskBudgetItems, saveRiskSimulationRun } from "@/lib/risk/data";
import { MONTE_CARLO_ITERATIONS } from "@/types/risk";
import {
  riskSimulationRunInputSchema,
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
    riskSimulationRun: {
      create: vi.fn() as any,
      findFirst: vi.fn() as any,
    },
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

  it("requires the fixed Monte Carlo iteration count for saved runs", () => {
    expect(() =>
      riskSimulationRunInputSchema.parse({
        ...validRunInput,
        iterations: MONTE_CARLO_ITERATIONS - 1,
      }),
    ).toThrow(ZodError);

    expect(riskSimulationRunInputSchema.parse(validRunInput).iterations).toBe(MONTE_CARLO_ITERATIONS);
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
});

const validRunInput = {
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
    createdAt,
  };
}
