import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BudgetTemplateDetail } from "@/components/templates/budget-template-detail";
import type { UserBudgetTemplateRecord } from "@/lib/data/budget-templates";

describe("BudgetTemplateDetail", () => {
  it("renders snapshot metrics, origin, items, and rates", () => {
    const markup = renderToStaticMarkup(<BudgetTemplateDetail template={createTemplate()} currencyDecimals={2} />);

    expect(markup).toContain("Partidas");
    expect(markup).toContain("Muro de ladrillo");
    expect(markup).toContain("Arquitectura fuente");
    expect(markup).toContain("18%");
    expect(markup).toContain("10%");
    expect(markup).toContain("8%");
  });
});

function createTemplate(): UserBudgetTemplateRecord {
  return {
    id: "template-1",
    userId: "user-1",
    sourceProjectId: "project-1",
    sourceBudgetId: "budget-1",
    name: "Arquitectura reusable",
    description: "Base validada.",
    createdAt: "2026-05-29T22:00:00.000Z",
    updatedAt: "2026-05-29T23:00:00.000Z",
    libraryItem: {
      id: "budget-template-template-1",
      module: "BUDGET",
      name: "Arquitectura reusable",
      description: "Base validada.",
      tags: ["Subpresupuesto"],
      status: "AVAILABLE",
      source: "USER",
      actionLabel: "Ver plantilla",
    },
    snapshot: {
      schemaVersion: 1,
      name: "Arquitectura reusable",
      description: "Base validada.",
      source: {
        budgetId: "budget-1",
        projectId: "project-1",
        budgetName: "Arquitectura fuente",
        capturedAt: "2026-05-29T22:00:00.000Z",
      },
      budget: {
        kind: "SUB_BUDGET",
        currency: "PEN",
        igvRate: 0.18,
        generalExpensesRate: 0.1,
        utilityRate: 0.08,
        totalDirectCost: 950,
        totalGeneralExpenses: 95,
        totalUtility: 76,
        totalTax: 201.78,
        totalAmount: 1322.78,
      },
      levels: [
        {
          templateKey: "level-001",
          sourceLevelId: "level-1",
          parentKey: null,
          type: "TITLE",
          code: "01",
          name: "Arquitectura",
          sortOrder: 1,
        },
      ],
      items: [
        {
          templateKey: "item-001",
          sourceItemId: "item-1",
          levelKey: "level-001",
          code: "01.01",
          description: "Muro de ladrillo",
          unit: "m2",
          quantity: 10,
          unitPrice: 95,
          partial: 950,
          sortOrder: 1,
          apu: null,
        },
      ],
      summary: {
        levelCount: 1,
        itemCount: 1,
        apuCount: 0,
        currency: "PEN",
        totalDirectCost: 950,
        totalAmount: 1322.78,
      },
    },
  };
}
