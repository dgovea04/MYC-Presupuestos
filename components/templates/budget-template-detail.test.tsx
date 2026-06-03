import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BudgetTemplateDetail } from "@/components/templates/budget-template-detail";
import type { UserBudgetTemplateRecord } from "@/lib/data/budget-templates";

describe("BudgetTemplateDetail", () => {
  it("renders snapshot metrics, origin, items, and rates", () => {
    const markup = renderToStaticMarkup(
      <BudgetTemplateDetail template={createTemplate()} currencyDecimals={2} sourceProjectName="Proyecto Colegio Sur" />,
    );

    expect(markup).toContain("Partidas");
    expect(markup).toContain("Muro de ladrillo");
    expect(markup).toContain("Arquitectura fuente");
    expect(markup).toContain("Proyecto fuente");
    expect(markup).toContain("Proyecto Colegio Sur");
    expect(markup).toContain('href="/projects/project-1"');
    expect(markup).toContain('href="/budgets/budget-1"');
    expect(markup).toContain("18%");
    expect(markup).toContain("10%");
    expect(markup).toContain("8%");
    expect(markup).toContain("Preparacion");
    expect(markup).toContain("Lista para aplicar");
    expect(markup).toContain("Cobertura APU");
    expect(markup).toContain("0 de 1 partidas");
    expect(markup).toContain("Actualizada");
  });

  it("summarizes truncated item and level previews", () => {
    const markup = renderToStaticMarkup(<BudgetTemplateDetail template={createLargeTemplate()} currencyDecimals={2} />);

    expect(markup).toContain("Mostrando 8 de 10 partidas");
    expect(markup).toContain("+2 partidas adicionales");
    expect(markup).toContain("Mostrando 9 de 11 niveles");
    expect(markup).toContain("+2 niveles adicionales");
    expect(markup).not.toContain("Partida 10");
    expect(markup).not.toContain("Nivel 11");
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

function createLargeTemplate(): UserBudgetTemplateRecord {
  const template = createTemplate();

  return {
    ...template,
    snapshot: {
      ...template.snapshot,
      levels: Array.from({ length: 11 }, (_, index) => ({
        templateKey: `level-${index + 1}`,
        sourceLevelId: `source-level-${index + 1}`,
        parentKey: null,
        type: "TITLE" as const,
        code: String(index + 1).padStart(2, "0"),
        name: `Nivel ${index + 1}`,
        sortOrder: index + 1,
      })),
      items: Array.from({ length: 10 }, (_, index) => ({
        templateKey: `item-${index + 1}`,
        sourceItemId: `source-item-${index + 1}`,
        levelKey: "level-1",
        code: `01.${String(index + 1).padStart(2, "0")}`,
        description: `Partida ${index + 1}`,
        unit: "m2",
        quantity: 1,
        unitPrice: 100,
        partial: 100,
        sortOrder: index + 1,
        apu: null,
      })),
      summary: {
        ...template.snapshot.summary,
        levelCount: 11,
        itemCount: 10,
      },
    },
  };
}
