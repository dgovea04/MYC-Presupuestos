import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveRiskScenario } from "@/lib/risk/scenarios";

const { budgetFindFirstMock, budgetItemFindManyMock, transactionMock } = vi.hoisted(() => ({
  budgetFindFirstMock: vi.fn(),
  budgetItemFindManyMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    budget: { findFirst: budgetFindFirstMock },
    budgetItem: { findMany: budgetItemFindManyMock },
    $transaction: transactionMock,
  },
}));

describe("saveRiskScenario", () => {
  beforeEach(() => {
    budgetFindFirstMock.mockReset();
    budgetItemFindManyMock.mockReset();
    transactionMock.mockReset();
  });

  it("rejects inaccessible budgets", async () => {
    budgetFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      saveRiskScenario("budget-1", "user-1", {
        name: "Escenario Khipu",
        description: "Riesgos sugeridos",
        variables: [],
        correlations: [],
      }),
    ).rejects.toThrow("No tienes permisos");
  });

  it("creates a scenario with submitted variables and correlations inside a transaction", async () => {
    budgetFindFirstMock.mockResolvedValueOnce({ id: "budget-1" });
    budgetItemFindManyMock.mockResolvedValueOnce([{ id: "item-1" }, { id: "item-2" }]);

    const tx = {
      riskScenario: {
        create: vi.fn().mockResolvedValue({
          id: "scenario-1",
          budgetId: "budget-1",
          name: "Escenario Khipu",
          description: "Riesgos sugeridos",
          source: "AGENT",
          status: "DRAFT",
          createdByUserId: "user-1",
          createdAt: new Date("2026-07-18T12:00:00.000Z"),
          updatedAt: new Date("2026-07-18T12:00:00.000Z"),
        }),
      },
      riskVariable: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: "created-var-1" })
          .mockResolvedValueOnce({ id: "created-var-2" }),
      },
      riskCorrelation: {
        create: vi.fn().mockResolvedValue({ id: "corr-1" }),
      },
    };

    transactionMock.mockImplementationOnce(async (callback: (txClient: typeof tx) => Promise<unknown>) => callback(tx));

    const result = await saveRiskScenario("budget-1", "user-1", {
      name: "Escenario Khipu",
      description: "Riesgos sugeridos",
      source: "AGENT",
      variables: [
        {
          id: "draft-var-1",
          budgetId: "budget-1",
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          distributionType: "TRIANGULAR",
          minimum: 8,
          mostLikely: 10,
          maximum: 13,
          enabled: true,
          source: "AGENT",
          confidence: 0.82,
          rationale: "Metrado con incertidumbre.",
        },
        {
          id: "draft-var-2",
          budgetId: "budget-1",
          budgetItemId: "item-2",
          variableType: "UNIT_PRICE",
          distributionType: "PERT",
          minimum: 90,
          mostLikely: 100,
          maximum: 120,
          enabled: true,
        },
      ],
      correlations: [
        {
          id: "draft-corr-1",
          budgetId: "budget-1",
          sourceVariableId: "draft-var-1",
          targetVariableId: "draft-var-2",
          coefficient: 0.35,
          source: "AGENT",
          confidence: 0.7,
          rationale: "Proveedor compartido.",
        },
      ],
    });

    expect(tx.riskScenario.create).toHaveBeenCalledWith({
      data: {
        budgetId: "budget-1",
        name: "Escenario Khipu",
        description: "Riesgos sugeridos",
        source: "AGENT",
        status: "DRAFT",
        createdByUserId: "user-1",
      },
    });
    expect(tx.riskVariable.create).toHaveBeenCalledTimes(2);
    expect(tx.riskVariable.create).toHaveBeenNthCalledWith(1, {
      data: {
        budgetId: "budget-1",
        scenarioId: "scenario-1",
        budgetItemId: "item-1",
        variableType: "QUANTITY",
        distributionType: "TRIANGULAR",
        minimum: 8,
        mostLikely: 10,
        maximum: 13,
        enabled: true,
        source: "AGENT",
        confidence: 0.82,
        rationale: "Metrado con incertidumbre.",
      },
      select: { id: true },
    });
    expect(tx.riskCorrelation.create).toHaveBeenCalledWith({
      data: {
        budgetId: "budget-1",
        scenarioId: "scenario-1",
        sourceVariableId: "created-var-1",
        targetVariableId: "created-var-2",
        coefficient: 0.35,
        source: "AGENT",
        confidence: 0.7,
        rationale: "Proveedor compartido.",
      },
    });
    expect(result).toEqual({
      id: "scenario-1",
      budgetId: "budget-1",
      name: "Escenario Khipu",
      description: "Riesgos sugeridos",
      source: "AGENT",
      status: "DRAFT",
      createdByUserId: "user-1",
      createdAt: "2026-07-18T12:00:00.000Z",
      updatedAt: "2026-07-18T12:00:00.000Z",
    });
  });

  it("rejects submitted variables that reference budget items outside the accessible budget", async () => {
    budgetFindFirstMock.mockResolvedValueOnce({ id: "budget-1" });
    budgetItemFindManyMock.mockResolvedValueOnce([{ id: "item-1" }]);

    await expect(
      saveRiskScenario("budget-1", "user-1", {
        name: "Escenario Khipu",
        variables: [
          {
            id: "draft-var-1",
            budgetItemId: "item-1",
            variableType: "QUANTITY",
            distributionType: "TRIANGULAR",
            minimum: 8,
            mostLikely: 10,
            maximum: 13,
            enabled: true,
          },
          {
            id: "draft-var-2",
            budgetItemId: "other-budget-item",
            variableType: "UNIT_PRICE",
            distributionType: "PERT",
            minimum: 90,
            mostLikely: 100,
            maximum: 120,
            enabled: true,
          },
        ],
        correlations: [],
      }),
    ).rejects.toThrow("partidas que no pertenecen");

    expect(budgetItemFindManyMock).toHaveBeenCalledWith({
      where: {
        budgetId: "budget-1",
        id: { in: ["item-1", "other-budget-item"] },
      },
      select: { id: true },
    });
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
