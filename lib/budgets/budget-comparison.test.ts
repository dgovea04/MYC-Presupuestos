import { describe, expect, it } from "vitest";

import { compareBudgets } from "@/lib/budgets/budget-comparison";
import type { BudgetItemRecord, BudgetRecord } from "@/types/budget";

describe("compareBudgets", () => {
  it("detects added, removed, changed, and unchanged partidas with decimal-safe totals", () => {
    const baseBudget = createBudget("base", "Version base", [
      createItem("base-1", "01.01", "Trazo y replanteo", "m2", 10, 1.23, 12.3),
      createItem("base-2", "02.01", "Concreto f'c 210", "m3", 3, 100.1, 300.3),
      createItem("base-3", "03.01", "Partida retirada", "und", 1, 25, 25),
    ]);
    const targetBudget = createBudget("target", "Version revisada", [
      createItem("target-1", "01.01", "Trazo y replanteo", "m2", 10, 1.23, 12.3),
      createItem("target-2", "02.01", "Concreto f'c 210", "m3", 4, 100.1, 400.4),
      createItem("target-4", "04.01", "Nueva partida", "kg", 2, 0.1, 0.2),
    ]);

    const comparison = compareBudgets(baseBudget, targetBudget);

    expect(comparison.summary).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
      unchanged: 1,
      netItemsDelta: 0,
    });
    expect(comparison.totals).toEqual({
      baseTotalDirectCost: 337.6,
      targetTotalDirectCost: 412.9,
      deltaDirectCost: 75.3,
      deltaDirectCostPercent: 22.3045,
    });
    expect(comparison.items.map((item) => [item.code, item.status])).toEqual([
      ["01.01", "UNCHANGED"],
      ["02.01", "CHANGED"],
      ["03.01", "REMOVED"],
      ["04.01", "ADDED"],
    ]);
    expect(comparison.items.find((item) => item.code === "02.01")?.deltas).toMatchObject({
      quantity: 1,
      unitPrice: 0,
      partial: 100.1,
      partialPercent: 33.3333,
    });
  });

  it("matches partidas without code by normalized description and unit", () => {
    const baseBudget = createBudget("base", "Base", [
      createItem("base-1", "", "ACERO corrugado fy=4200 kg/cm2", "KG", 1, 10, 10),
    ]);
    const targetBudget = createBudget("target", "Revisada", [
      createItem("target-1", "", "Acero corrugado fy 4200 kg cm2", "kg", 1, 10, 10),
    ]);

    const comparison = compareBudgets(baseBudget, targetBudget);

    expect(comparison.summary.unchanged).toBe(1);
    expect(comparison.items[0]?.status).toBe("UNCHANGED");
    expect(comparison.items[0]?.key).toBe("item:acero corrugado fy 4200 kg cm2|unit:kg");
  });

  it("returns null percentages when the base amount is zero", () => {
    const comparison = compareBudgets(
      createBudget("base", "Base", []),
      createBudget("target", "Revisada", [createItem("target-1", "01", "Nueva partida", "und", 1, 20, 20)]),
    );

    expect(comparison.totals.deltaDirectCostPercent).toBeNull();
    expect(comparison.items[0]?.deltas.partialPercent).toBeNull();
  });
});

function createBudget(id: string, name: string, items: BudgetItemRecord[]): BudgetRecord {
  const totalDirectCost = items.reduce((sum, item) => sum + item.partial, 0);

  return {
    id,
    projectId: "project-1",
    parentBudgetId: null,
    kind: "SUB_BUDGET",
    name,
    currency: "PEN",
    igvRate: 0.18,
    generalExpensesRate: 0.1,
    utilityRate: 0.08,
    totalDirectCost,
    totalGeneralExpenses: 0,
    totalUtility: 0,
    totalTax: 0,
    totalAmount: totalDirectCost,
    levels: [],
    items,
  };
}

function createItem(
  id: string,
  code: string,
  description: string,
  unit: string,
  quantity: number,
  unitPrice: number,
  partial: number,
): BudgetItemRecord {
  return {
    id,
    budgetId: "budget-1",
    levelId: null,
    code,
    description,
    unit,
    quantity,
    unitPrice,
    partial,
    sortOrder: 1,
    apu: null,
  };
}
