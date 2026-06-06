import { describe, expect, it } from "vitest";

import {
  buildTemplateDashboardSummary,
  mapNoteTasksToPendingItems,
  normalizePolynomialFormulaActivityHref,
  normalizeDashboardActivityEventType,
} from "@/lib/data/dashboard";
import type { NoteTaskRecord } from "@/types/notes";

describe("dashboard note pending items", () => {
  it("maps open note tasks to dashboard pending items", () => {
    const notes: NoteTaskRecord[] = [
      {
        id: "note-1",
        body: "Revisar metrado de concreto",
        priority: "HIGH",
        status: "OPEN",
        projectId: "project-1",
        projectName: "Colegio Sur",
        budgetName: "Estructuras",
        budgetItemCode: "01.01",
        budgetItemDescription: "Concreto",
        sourcePath: "/budgets/budget-1",
        createdAt: "2026-05-27T10:00:00.000Z",
        updatedAt: "2026-05-27T10:15:00.000Z",
      },
    ];

    expect(mapNoteTasksToPendingItems(notes)).toEqual([
      {
        id: "note-note-1",
        projectId: "project-1",
        projectName: "Colegio Sur",
        companyName: "Sticky note",
        status: "PLANNING",
        observation: "Revisar metrado de concreto",
        priority: "high",
        updatedAt: new Date("2026-05-27T10:15:00.000Z"),
        href: "/budgets/budget-1",
        type: "USER_NOTE_TASK",
      },
    ]);
  });
});

describe("dashboard template summary", () => {
  it("summarizes saved templates, application count, and latest snapshot", () => {
    const summary = buildTemplateDashboardSummary(
      [
        {
          id: "template-2",
          name: "Arquitectura costa",
          updatedAt: new Date("2026-05-30T10:00:00.000Z"),
          payload: { summary: { itemCount: 12 } },
        },
        {
          id: "template-1",
          name: "Arquitectura base",
          updatedAt: new Date("2026-05-29T10:00:00.000Z"),
          payload: { summary: { itemCount: 8 } },
        },
      ],
      3,
      5,
    );

    expect(summary).toEqual({
      savedTemplatesCount: 2,
      templateBudgetApplicationCount: 3,
      templateMaintenanceEventCount: 5,
      totalTemplateItems: 20,
      averageItemsPerTemplate: 10,
      latestTemplate: {
        id: "template-2",
        name: "Arquitectura costa",
        updatedAt: new Date("2026-05-30T10:00:00.000Z"),
        itemCount: 12,
      },
    });
  });
});

describe("dashboard activity normalization", () => {
  it("normalizes polynomial formula activity links from sub-budgets to their general budget route", () => {
    const routeBudgetIdByBudgetId = new Map([
      ["general-budget-1", "general-budget-1"],
      ["sub-budget-1", "general-budget-1"],
    ]);

    expect(
      normalizePolynomialFormulaActivityHref(
        "/budgets/sub-budget-1/polynomial-formula",
        routeBudgetIdByBudgetId,
      ),
    ).toBe("/budgets/general-budget-1/polynomial-formula");
  });

  it("keeps polynomial formula activity link suffixes when normalizing", () => {
    const routeBudgetIdByBudgetId = new Map([["sub-budget-1", "general-budget-1"]]);

    expect(
      normalizePolynomialFormulaActivityHref(
        "/budgets/sub-budget-1/polynomial-formula?focus=adjustment",
        routeBudgetIdByBudgetId,
      ),
    ).toBe("/budgets/general-budget-1/polynomial-formula?focus=adjustment");
  });

  it("maps metrado duplication activity to the metrado dashboard type", () => {
    expect(
      normalizeDashboardActivityEventType({
        type: "BUDGET_UPDATED",
        title: "Metrado duplicado",
        href: "/metrados-avanzados",
      }),
    ).toBe("METRADO_DUPLICATED");
  });

  it("maps template activities to the template dashboard type", () => {
    const events = [
      { type: "BUDGET_CREATED" as const, title: "Plantilla creada" },
      { type: "BUDGET_UPDATED" as const, title: "Plantilla actualizada" },
      { type: "BUDGET_UPDATED" as const, title: "Plantilla duplicada" },
      { type: "BUDGET_UPDATED" as const, title: "Plantilla eliminada", href: "/templates" },
    ];

    for (const event of events) {
      expect(
        normalizeDashboardActivityEventType({
          ...event,
          href: "href" in event ? event.href : "/templates/budget/template-copy",
        }),
      ).toBe("TEMPLATE_CHANGED");
    }
  });
});
