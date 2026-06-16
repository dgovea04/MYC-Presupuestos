import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    project: {
      findMany: vi.fn(),
    },
    budget: {
      findMany: vi.fn(),
    },
    polynomialFormula: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  getCostByPhaseAnalytics,
  getBudgetComparison,
  getCostTrends,
  getDeviationAlerts,
} from "@/lib/dashboard/analytics";

function createPrismaDecimal(value: number) {
  return new Prisma.Decimal(value);
}

describe("getCostByPhaseAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cost breakdown by sub-budget for each project with a general budget", async () => {
    mocks.prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        name: "Vivienda San Miguel",
        budgets: [
          {
            id: "budget-general-1",
            currency: "PEN",
            totalAmount: createPrismaDecimal("500000"),
            childBudgets: [
              {
                name: "Estructuras",
                totalDirectCost: createPrismaDecimal("150000"),
                totalAmount: createPrismaDecimal("200000"),
                currency: "PEN",
              },
              {
                name: "Arquitectura",
                totalDirectCost: createPrismaDecimal("100000"),
                totalAmount: createPrismaDecimal("180000"),
                currency: "PEN",
              },
              {
                name: "Instalaciones Sanitarias",
                totalDirectCost: createPrismaDecimal("50000"),
                totalAmount: createPrismaDecimal("70000"),
                currency: "PEN",
              },
              {
                name: "Instalaciones Electricas",
                totalDirectCost: createPrismaDecimal("35000"),
                totalAmount: createPrismaDecimal("50000"),
                currency: "PEN",
              },
            ],
          },
        ],
      },
      {
        id: "project-2",
        name: "Colegio Sur",
        budgets: [
          {
            id: "budget-general-2",
            currency: "PEN",
            totalAmount: createPrismaDecimal("800000"),
            childBudgets: [
              {
                name: "Estructuras",
                totalDirectCost: createPrismaDecimal("400000"),
                totalAmount: createPrismaDecimal("550000"),
                currency: "PEN",
              },
              {
                name: "Arquitectura",
                totalDirectCost: createPrismaDecimal("180000"),
                totalAmount: createPrismaDecimal("250000"),
                currency: "PEN",
              },
            ],
          },
        ],
      },
    ]);

    const result = await getCostByPhaseAnalytics("user-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      projectId: "project-1",
      projectName: "Vivienda San Miguel",
      generalBudgetId: "budget-general-1",
      generalTotal: 500000,
      currency: "PEN",
      subBudgets: [
        { subBudgetName: "Estructuras", totalDirectCost: 150000, totalAmount: 200000, currency: "PEN" },
        { subBudgetName: "Arquitectura", totalDirectCost: 100000, totalAmount: 180000, currency: "PEN" },
        { subBudgetName: "Instalaciones Sanitarias", totalDirectCost: 50000, totalAmount: 70000, currency: "PEN" },
        { subBudgetName: "Instalaciones Electricas", totalDirectCost: 35000, totalAmount: 50000, currency: "PEN" },
      ],
    });
    expect(result[1]).toEqual({
      projectId: "project-2",
      projectName: "Colegio Sur",
      generalBudgetId: "budget-general-2",
      generalTotal: 800000,
      currency: "PEN",
      subBudgets: [
        { subBudgetName: "Estructuras", totalDirectCost: 400000, totalAmount: 550000, currency: "PEN" },
        { subBudgetName: "Arquitectura", totalDirectCost: 180000, totalAmount: 250000, currency: "PEN" },
      ],
    });
  });

  it("filters out projects without a general budget", async () => {
    mocks.prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        name: "Con presupuesto",
        budgets: [
          {
            id: "budget-general-1",
            currency: "PEN",
            totalAmount: createPrismaDecimal("100000"),
            childBudgets: [],
          },
        ],
      },
      {
        id: "project-2",
        name: "Sin presupuesto",
        budgets: [],
      },
    ]);

    const result = await getCostByPhaseAnalytics("user-1");

    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe("project-1");
  });

  it("returns empty array when no projects exist", async () => {
    mocks.prisma.project.findMany.mockResolvedValue([]);

    const result = await getCostByPhaseAnalytics("user-1");

    expect(result).toEqual([]);
  });

  it("handles project with general budget but no sub-budgets", async () => {
    mocks.prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        name: "Proyecto sin subpresupuestos",
        budgets: [
          {
            id: "budget-general-1",
            currency: "PEN",
            totalAmount: createPrismaDecimal("50000"),
            childBudgets: [],
          },
        ],
      },
    ]);

    const result = await getCostByPhaseAnalytics("user-1");

    expect(result).toHaveLength(1);
    expect(result[0].subBudgets).toEqual([]);
  });
});

describe("getBudgetComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns sorted budget comparison data for all general budgets", async () => {
    mocks.prisma.budget.findMany.mockResolvedValue([
      {
        id: "budget-1",
        name: "Presupuesto General",
        currency: "PEN",
        totalAmount: createPrismaDecimal("500000"),
        totalDirectCost: createPrismaDecimal("350000"),
        updatedAt: new Date("2026-05-15T10:00:00.000Z"),
        projectId: "project-1",
        project: { name: "Vivienda San Miguel" },
      },
      {
        id: "budget-2",
        name: "Presupuesto General",
        currency: "PEN",
        totalAmount: createPrismaDecimal("800000"),
        totalDirectCost: createPrismaDecimal("580000"),
        updatedAt: new Date("2026-06-01T10:00:00.000Z"),
        projectId: "project-2",
        project: { name: "Colegio Sur" },
      },
    ]);

    // Mock data is returned in array order since Prisma is mocked
    const result = await getBudgetComparison("user-1");

    expect(result).toHaveLength(2);
    // First in mock array, so first in result
    expect(result[0]).toEqual({
      projectId: "project-1",
      projectName: "Vivienda San Miguel",
      budgetId: "budget-1",
      totalAmount: 500000,
      totalDirectCost: 350000,
      currency: "PEN",
      updatedAt: new Date("2026-05-15T10:00:00.000Z"),
    });
    expect(result[1]).toEqual({
      projectId: "project-2",
      projectName: "Colegio Sur",
      budgetId: "budget-2",
      totalAmount: 800000,
      totalDirectCost: 580000,
      currency: "PEN",
      updatedAt: new Date("2026-06-01T10:00:00.000Z"),
    });
  });

  it("returns empty array when no general budgets exist", async () => {
    mocks.prisma.budget.findMany.mockResolvedValue([]);

    const result = await getBudgetComparison("user-1");

    expect(result).toEqual([]);
  });

  it("verifies the query is scoped to GENERAL kind only", async () => {
    mocks.prisma.budget.findMany.mockResolvedValue([]);

    await getBudgetComparison("user-1");

    expect(mocks.prisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: "GENERAL",
        }),
      }),
    );
  });
});

describe("getCostTrends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns sorted cost trend points from polynomial formula adjustments", async () => {
    mocks.prisma.polynomialFormula.findMany.mockResolvedValue([
      {
        id: "formula-1",
        name: "Formula General",
        project: { name: "Vivienda San Miguel" },
        adjustments: [
          { month: 1, year: 2026, kRounded: createPrismaDecimal("1.025") },
          { month: 2, year: 2026, kRounded: createPrismaDecimal("1.048") },
          { month: 3, year: 2026, kRounded: createPrismaDecimal("1.032") },
        ],
      },
      {
        id: "formula-2",
        name: "Formula General",
        project: { name: "Colegio Sur" },
        adjustments: [
          { month: 1, year: 2026, kRounded: createPrismaDecimal("1.015") },
          { month: 2, year: 2026, kRounded: createPrismaDecimal("1.022") },
        ],
      },
    ]);

    const result = await getCostTrends("user-1");

    expect(result).toHaveLength(5);
    // Sorted by period ascending
    expect(result[0]).toEqual({
      period: "2026-01",
      label: "01/2026",
      kValue: 1.025,
      projectName: "Vivienda San Miguel",
      budgetName: "Formula General",
    });
    expect(result[1]).toEqual({
      period: "2026-01",
      label: "01/2026",
      kValue: 1.015,
      projectName: "Colegio Sur",
      budgetName: "Formula General",
    });
    expect(result[4]).toEqual({
      period: "2026-03",
      label: "03/2026",
      kValue: 1.032,
      projectName: "Vivienda San Miguel",
      budgetName: "Formula General",
    });
  });

  it("skips adjustment entries with zero K value", async () => {
    mocks.prisma.polynomialFormula.findMany.mockResolvedValue([
      {
        id: "formula-1",
        name: "Formula General",
        project: { name: "Proyecto" },
        adjustments: [
          { month: 1, year: 2026, kRounded: createPrismaDecimal("1.000") },
          { month: 2, year: 2026, kRounded: createPrismaDecimal("0") },
          { month: 3, year: 2026, kRounded: createPrismaDecimal("1.050") },
        ],
      },
    ]);

    const result = await getCostTrends("user-1");

    expect(result).toHaveLength(2);
  });

  it("returns empty array when no formulas exist", async () => {
    mocks.prisma.polynomialFormula.findMany.mockResolvedValue([]);

    const result = await getCostTrends("user-1");

    expect(result).toEqual([]);
  });

  it("returns empty array when formulas have no adjustments", async () => {
    mocks.prisma.polynomialFormula.findMany.mockResolvedValue([
      {
        id: "formula-1",
        name: "Formula",
        project: { name: "Proyecto" },
        adjustments: [],
      },
    ]);

    const result = await getCostTrends("user-1");

    expect(result).toEqual([]);
  });
});

describe("getDeviationAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns deviation alerts sorted by severity (highest deviation first)", async () => {
    mocks.prisma.polynomialFormula.findMany.mockResolvedValue([
      {
        id: "formula-1",
        name: "Formula General",
        totalBaseAmount: createPrismaDecimal("500000"),
        budgetId: "budget-1",
        project: { id: "project-1", name: "Vivienda San Miguel" },
        adjustments: [
          {
            id: "adj-1",
            month: 3,
            year: 2026,
            originalAmount: createPrismaDecimal("150000"),
            adjustedAmount: createPrismaDecimal("187500"),
          },
        ],
      },
      {
        id: "formula-2",
        name: "Formula General",
        totalBaseAmount: createPrismaDecimal("800000"),
        budgetId: "budget-2",
        project: { id: "project-2", name: "Colegio Sur" },
        adjustments: [
          {
            id: "adj-2",
            month: 5,
            year: 2026,
            originalAmount: createPrismaDecimal("200000"),
            adjustedAmount: createPrismaDecimal("210000"),
          },
        ],
      },
    ]);

    const result = await getDeviationAlerts("user-1");

    expect(result).toHaveLength(2);
    // First alert has higher deviation (25% vs 5%)
    expect(result[0].deviationPercent).toBe(25);
    expect(result[0]).toEqual({
      id: "adj-1",
      projectName: "Vivienda San Miguel",
      budgetName: "Formula General",
      href: "/budgets/budget-1/polynomial-formula?focus=adjustment",
      originalAmount: 150000,
      adjustedAmount: 187500,
      deviationAmount: 37500,
      deviationPercent: 25,
      period: "3/2026",
      severity: "high",
      currency: "PEN",
    });
    expect(result[1].severity).toBe("low");
    expect(result[1].deviationPercent).toBe(5);
  });

  it("skips formulas without adjustments", async () => {
    mocks.prisma.polynomialFormula.findMany.mockResolvedValue([
      {
        id: "formula-1",
        name: "Formula Sin Ajustes",
        totalBaseAmount: createPrismaDecimal("500000"),
        budgetId: "budget-1",
        project: { id: "project-1", name: "Proyecto" },
        adjustments: [],
      },
    ]);

    const result = await getDeviationAlerts("user-1");

    expect(result).toEqual([]);
  });

  it("skips deviations with negligible amount (< 1)", async () => {
    mocks.prisma.polynomialFormula.findMany.mockResolvedValue([
      {
        id: "formula-1",
        name: "Formula",
        totalBaseAmount: createPrismaDecimal("500000"),
        budgetId: "budget-1",
        project: { id: "project-1", name: "Proyecto" },
        adjustments: [
          {
            id: "adj-1",
            month: 3,
            year: 2026,
            originalAmount: createPrismaDecimal("1000"),
            adjustedAmount: createPrismaDecimal("1000.50"),
          },
        ],
      },
    ]);

    const result = await getDeviationAlerts("user-1");

    expect(result).toEqual([]);
  });

  it("returns empty array when no formulas exist", async () => {
    mocks.prisma.polynomialFormula.findMany.mockResolvedValue([]);

    const result = await getDeviationAlerts("user-1");

    expect(result).toEqual([]);
  });

  it("uses the latest adjustment when multiple exist per formula", async () => {
    // Mock data must have latest adjustment first (matches Prisma orderBy: [{ year: "desc" }, { month: "desc" }])
    mocks.prisma.polynomialFormula.findMany.mockResolvedValue([
      {
        id: "formula-1",
        name: "Formula",
        totalBaseAmount: createPrismaDecimal("500000"),
        budgetId: "budget-1",
        project: { id: "project-1", name: "Proyecto" },
        adjustments: [
          {
            id: "adj-latest",
            month: 5,
            year: 2026,
            originalAmount: createPrismaDecimal("100000"),
            adjustedAmount: createPrismaDecimal("130000"),
          },
          {
            id: "adj-old",
            month: 1,
            year: 2026,
            originalAmount: createPrismaDecimal("50000"),
            adjustedAmount: createPrismaDecimal("60000"),
          },
        ],
      },
    ]);

    const result = await getDeviationAlerts("user-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("adj-latest");
    expect(result[0].deviationPercent).toBe(30);
  });

  it("classifies severity correctly based on deviation percentage thresholds", async () => {
    mocks.prisma.polynomialFormula.findMany.mockResolvedValue([
      {
        id: "formula-high",
        name: "Alta",
        totalBaseAmount: createPrismaDecimal("100000"),
        budgetId: "budget-1",
        project: { id: "project-1", name: "Proyecto 1" },
        adjustments: [
          {
            id: "adj-high",
            month: 1,
            year: 2026,
            originalAmount: createPrismaDecimal("20000"),
            adjustedAmount: createPrismaDecimal("25000"),
          },
        ],
      },
      {
        id: "formula-medium",
        name: "Media",
        totalBaseAmount: createPrismaDecimal("100000"),
        budgetId: "budget-2",
        project: { id: "project-2", name: "Proyecto 2" },
        adjustments: [
          {
            id: "adj-medium",
            month: 1,
            year: 2026,
            originalAmount: createPrismaDecimal("20000"),
            adjustedAmount: createPrismaDecimal("21800"),
          },
        ],
      },
      {
        id: "formula-low",
        name: "Baja",
        totalBaseAmount: createPrismaDecimal("100000"),
        budgetId: "budget-3",
        project: { id: "project-3", name: "Proyecto 3" },
        adjustments: [
          {
            id: "adj-low",
            month: 1,
            year: 2026,
            originalAmount: createPrismaDecimal("20000"),
            adjustedAmount: createPrismaDecimal("20400"),
          },
        ],
      },
    ]);

    const result = await getDeviationAlerts("user-1");

    expect(result.find((a) => a.id === "adj-high")?.severity).toBe("high");
    expect(result.find((a) => a.id === "adj-medium")?.severity).toBe("medium");
    expect(result.find((a) => a.id === "adj-low")?.severity).toBe("low");
  });
});
