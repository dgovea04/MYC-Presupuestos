import { describe, expect, it } from "vitest";

import {
  buildBudgetSnapshotTemplateLibraryItem,
  buildTemplateActionHref,
  filterTemplateLibraryItems,
  filterTemplateLibraryItemsByCriteria,
  getTemplateLibraryItem,
  getTemplateLibrarySummary,
  listTemplateLibraryItems,
} from "@/lib/templates/template-library";
import type { BudgetTemplateSnapshot } from "@/lib/templates/budget-template-snapshot";

describe("template library", () => {
  it("combines system templates with the existing metrado templates", () => {
    const items = listTemplateLibraryItems();

    expect(items.map((item) => item.id)).toContain("budget-edificacion-base");
    expect(items.map((item) => item.id)).toContain("general-expenses-fixed-workbook");
    expect(items.map((item) => item.id)).toContain("general-expenses-variable-workbook");
    expect(items.map((item) => item.id)).toContain("metrado-concrete");
    expect(items.filter((item) => item.module === "METRADOS")).toHaveLength(10);
  });

  it("builds an executive summary for the library", () => {
    const summary = getTemplateLibrarySummary(listTemplateLibraryItems());

    expect(summary).toEqual({
      total: 15,
      modules: 5,
      workbookTemplates: 3,
      systemTemplates: 12,
      userTemplates: 0,
    });
  });

  it("adapts budget snapshots into user template library items", () => {
    const item = buildBudgetSnapshotTemplateLibraryItem(createBudgetSnapshot(), "template-1", {
      createdAt: "2026-05-29T22:00:00.000Z",
      updatedAt: "2026-05-30T12:00:00.000Z",
    });
    const summary = getTemplateLibrarySummary(listTemplateLibraryItems([item]));

    expect(item).toEqual({
      id: "budget-template-template-1",
      module: "BUDGET",
      name: "Arquitectura base",
      description: "Plantilla capturada desde Arquitectura.",
      tags: ["Subpresupuesto", "PEN", "2 partidas"],
      status: "AVAILABLE",
      source: "USER",
      actionLabel: "Ver plantilla",
      createdAt: "2026-05-29T22:00:00.000Z",
      updatedAt: "2026-05-30T12:00:00.000Z",
    });
    expect(summary.userTemplates).toBe(1);
    expect(summary.total).toBe(16);
  });

  it("links user budget templates to the saved template detail page", () => {
    const item = buildBudgetSnapshotTemplateLibraryItem(createBudgetSnapshot(), "template-1");

    expect(buildTemplateActionHref(item)).toBe("/templates/budget/template-1");
  });

  it("filters templates by module", () => {
    const items = listTemplateLibraryItems();

    expect(filterTemplateLibraryItems(items, "GENERAL_EXPENSES")).toEqual([
      expect.objectContaining({ id: "general-expenses-fixed-workbook" }),
      expect.objectContaining({ id: "general-expenses-variable-workbook" }),
    ]);
    expect(filterTemplateLibraryItems(items, "ALL")).toHaveLength(items.length);
  });

  it("filters templates by module, source and normalized search text", () => {
    const userTemplate = buildBudgetSnapshotTemplateLibraryItem(createBudgetSnapshot(), "template-1");
    const items = listTemplateLibraryItems([userTemplate]);

    expect(
      filterTemplateLibraryItemsByCriteria(items, {
        module: "BUDGET",
        source: "USER",
        query: "arquitectura",
      }),
    ).toEqual([expect.objectContaining({ id: "budget-template-template-1" })]);
    expect(
      filterTemplateLibraryItemsByCriteria(items, {
        module: "GENERAL_EXPENSES",
        source: "USER",
        query: "arquitectura",
      }),
    ).toHaveLength(0);
    expect(filterTemplateLibraryItemsByCriteria(items, { query: "edificacion" })).toEqual([
      expect.objectContaining({ id: "budget-edificacion-base" }),
    ]);
  });

  it("resolves action links for templates that can start workflows", () => {
    const budgetTemplate = getTemplateLibraryItem("budget-edificacion-base");
    const fixedExpensesTemplate = getTemplateLibraryItem("general-expenses-fixed-workbook");
    const variableExpensesTemplate = getTemplateLibraryItem("general-expenses-variable-workbook");
    const metradoTemplate = getTemplateLibraryItem("metrado-concrete");

    expect(budgetTemplate ? buildTemplateActionHref(budgetTemplate) : "").toBe(
      "/projects/new?template=budget-edificacion-base",
    );
    expect(fixedExpensesTemplate ? buildTemplateActionHref(fixedExpensesTemplate) : "").toBe(
      "/budgets?template=general-expenses-fixed-workbook",
    );
    expect(variableExpensesTemplate ? buildTemplateActionHref(variableExpensesTemplate) : "").toBe(
      "/budgets?template=general-expenses-variable-workbook",
    );
    expect(metradoTemplate ? buildTemplateActionHref(metradoTemplate) : "").toBe(
      "/metrados-avanzados?template=metrado-concrete",
    );
  });
});

function createBudgetSnapshot(): BudgetTemplateSnapshot {
  return {
    schemaVersion: 1,
    name: "Arquitectura base",
    description: "",
    source: {
      budgetId: "budget-1",
      projectId: "project-1",
      budgetName: "Arquitectura",
      capturedAt: "2026-05-29T22:00:00.000Z",
    },
    budget: {
      kind: "SUB_BUDGET",
      currency: "PEN",
      igvRate: 0.18,
      generalExpensesRate: 0.1,
      utilityRate: 0.08,
      totalDirectCost: 120,
      totalGeneralExpenses: 12,
      totalUtility: 9.6,
      totalTax: 25.488,
      totalAmount: 167.088,
    },
    levels: [],
    items: [],
    summary: {
      levelCount: 1,
      itemCount: 2,
      apuCount: 1,
      currency: "PEN",
      totalDirectCost: 120,
      totalAmount: 167.088,
    },
  };
}
