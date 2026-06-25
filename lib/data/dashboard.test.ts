import { describe, expect, it } from "vitest";

import {
  buildTemplateDashboardSummary,
  mapNoteTasksToPendingItems,
  normalizePolynomialFormulaActivityHref,
  normalizeDashboardActivityEventType,
  normalizeDashboardDates,
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
      { type: "BUDGET_CREATED" as const, title: "Plantilla creada", href: "/templates/budget/template-copy" },
      { type: "BUDGET_UPDATED" as const, title: "Plantilla actualizada", href: "/templates/budget/template-copy" },
      { type: "BUDGET_UPDATED" as const, title: "Plantilla duplicada", href: "/templates/budget/template-copy" },
      { type: "BUDGET_UPDATED" as const, title: "Plantilla eliminada", href: "/templates" },
    ];

    for (const event of events) {
      expect(
        normalizeDashboardActivityEventType({
          type: event.type,
          title: event.title,
          href: event.href,
        }),
      ).toBe("TEMPLATE_CHANGED");
    }
  });
});

describe("normalizeDashboardDates", () => {
  it("converts string dates back to Date objects after JSON serialization (unstable_cache HIT scenario)", () => {
    const isoNow = new Date().toISOString();
    const isoYesterday = new Date(Date.now() - 86400000).toISOString();
    const isoLastWeek = new Date(Date.now() - 7 * 86400000).toISOString();

    // Simulate what unstable_cache returns: JSON-deserialized data where all Date fields are strings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally testing with string dates to simulate JSON deserialization
    const cachedStats: any = {
      companiesCount: 2,
      projectsCount: 3,
      budgetsCount: 2,
      portfolioValue: 500000,
      monthlyAdjustmentsCount: 1,
      pendingCount: 2,
      recentProject: {
        id: "proj-1",
        name: "Test Project",
        companyName: "Test Co",
        status: "ACTIVE",
        updatedAt: isoYesterday,
        generalBudget: {
          id: "budget-1",
          totalAmount: 250000,
          currency: "PEN",
        },
      },
      projects: [
        {
          id: "proj-1",
          name: "Project A",
          companyName: "Co A",
          location: "Lima",
          status: "ACTIVE",
          updatedAt: isoNow,
        },
      ],
      budgets: [
        {
          id: "budget-1",
          name: "Budget A",
          projectId: "proj-1",
          projectName: "Project A",
          updatedAt: isoYesterday,
          totalAmount: 250000,
          currency: "PEN",
        },
      ],
      pendingItems: [
        {
          id: "pend-1",
          projectId: "proj-1",
          projectName: "Project A",
          companyName: "Co A",
          status: "ACTIVE",
          observation: "Test",
          priority: "high" as const,
          updatedAt: isoLastWeek,
          href: "/projects/proj-1",
          type: "MISSING_GENERAL_BUDGET" as const,
        },
      ],
      templateSummary: {
        savedTemplatesCount: 1,
        templateBudgetApplicationCount: 0,
        templateMaintenanceEventCount: 0,
        totalTemplateItems: 5,
        averageItemsPerTemplate: 5,
        latestTemplate: {
          id: "tpl-1",
          name: "Template A",
          updatedAt: isoYesterday,
          itemCount: 5,
        },
      },
      recentActivity: [
        {
          id: "act-1",
          type: "PROJECT_UPDATED" as const,
          title: "Project updated",
          detail: "Details",
          projectName: "Project A",
          href: "/projects/proj-1",
          createdAt: isoNow,
        },
        {
          id: "act-2",
          type: "GENERAL_BUDGET_UPDATED" as const,
          title: "Budget updated",
          detail: "Details",
          projectName: "Project A",
          href: "/budgets/budget-1",
          createdAt: isoYesterday,
        },
        {
          id: "act-3",
          type: "ADJUSTMENT_REGISTERED" as const,
          title: "Adjustment",
          detail: "Details",
          projectName: "Project A",
          href: "/projects/proj-1",
          createdAt: isoLastWeek,
        },
      ],
    };

    // Before normalization, dates are strings — .getTime() would throw
    expect(typeof cachedStats.recentProject!.updatedAt).toBe("string");
    expect(typeof cachedStats.recentActivity[0].createdAt).toBe("string");

    // After normalization, all dates should be real Date objects
    const normalized = normalizeDashboardDates(cachedStats);

    // Verify recentProject.updatedAt is a Date
    expect(normalized.recentProject!.updatedAt).toBeInstanceOf(Date);
    expect(() => normalized.recentProject!.updatedAt.getTime()).not.toThrow();

    // Verify projects[].updatedAt are Dates
    for (const p of normalized.projects) {
      expect(p.updatedAt).toBeInstanceOf(Date);
      expect(() => p.updatedAt.getTime()).not.toThrow();
    }

    // Verify budgets[].updatedAt are Dates
    for (const b of normalized.budgets) {
      expect(b.updatedAt).toBeInstanceOf(Date);
      expect(() => b.updatedAt.getTime()).not.toThrow();
    }

    // Verify pendingItems[].updatedAt are Dates
    for (const i of normalized.pendingItems) {
      expect(i.updatedAt).toBeInstanceOf(Date);
      expect(() => i.updatedAt.getTime()).not.toThrow();
    }

    // Verify templateSummary.latestTemplate.updatedAt is a Date
    expect(normalized.templateSummary.latestTemplate!.updatedAt).toBeInstanceOf(Date);
    expect(() => normalized.templateSummary.latestTemplate!.updatedAt.getTime()).not.toThrow();

    // Verify recentActivity[].createdAt are Dates — THIS WAS THE BUG
    for (const a of normalized.recentActivity) {
      expect(a.createdAt).toBeInstanceOf(Date);
      expect(() => a.createdAt.getTime()).not.toThrow();
    }

    // Verify this-week activity filter (the exact code that was crashing)
    const weekAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;
    expect(() => {
      normalized.recentActivity.filter((item) => item.createdAt.getTime() >= weekAgo);
    }).not.toThrow();
  });
});
