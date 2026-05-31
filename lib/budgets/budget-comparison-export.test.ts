import { describe, expect, it } from "vitest";

import { compareBudgets } from "@/lib/budgets/budget-comparison";
import {
  buildBudgetComparisonCsv,
  buildBudgetComparisonCsvFilename,
} from "@/lib/budgets/budget-comparison-export";
import type { BudgetItemRecord, BudgetRecord } from "@/types/budget";

describe("budget comparison export", () => {
  it("builds an escaped CSV report for a budget comparison", () => {
    const comparison = compareBudgets(
      createBudget("base", "Base, contractual", [createItem("base-1", "01", "Muro \"tipo A\"", "m2", 1, 20, 20)]),
      createBudget("target", "Revision final", [createItem("target-1", "01", "Muro \"tipo A\"", "m2", 2, 20, 40)]),
    );

    const csv = buildBudgetComparisonCsv(comparison);

    expect(csv).toContain('presupuesto_base,"Base, contractual"');
    expect(csv).toContain("estado,codigo,descripcion,unidad");
    expect(csv).toContain('CHANGED,01,"Muro ""tipo A""",m2,1,2,20,20,20,40,20,100');
  });

  it("normalizes the CSV filename from both compared budgets", () => {
    const comparison = compareBudgets(
      createBudget("base", "Versión Base", []),
      createBudget("target", "Revisión Técnica 02", []),
    );

    expect(buildBudgetComparisonCsvFilename(comparison)).toBe("comparador-version-base-vs-revision-tecnica-02.csv");
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
