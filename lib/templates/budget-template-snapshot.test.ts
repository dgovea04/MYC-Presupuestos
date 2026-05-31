import { describe, expect, it } from "vitest";

import {
  buildBudgetFromTemplateSnapshot,
  buildBudgetTemplateSnapshot,
} from "@/lib/templates/budget-template-snapshot";
import type { BudgetRecord } from "@/types/budget";

describe("budget template snapshots", () => {
  it("builds a reusable snapshot from a calculated budget without database ids", () => {
    const snapshot = buildBudgetTemplateSnapshot(createBudget(), {
      capturedAt: "2026-05-29T22:00:00.000Z",
      description: "Base para edificacion multifamiliar.",
      name: "Edificacion multifamiliar base",
    });

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      name: "Edificacion multifamiliar base",
      description: "Base para edificacion multifamiliar.",
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
        totalDirectCost: 623.7063,
        totalAmount: 868.4487,
      },
      summary: {
        levelCount: 2,
        itemCount: 2,
        apuCount: 1,
        currency: "PEN",
        totalDirectCost: 623.7063,
        totalAmount: 868.4487,
      },
    });
    expect(snapshot.levels.map((level) => level.templateKey)).toEqual(["level-001", "level-002"]);
    expect(snapshot.levels[1]?.parentKey).toBe("level-001");
    expect(snapshot.items.map((item) => item.templateKey)).toEqual(["item-001", "item-002"]);
    expect(snapshot.items[0]).not.toHaveProperty("id");
    expect(snapshot.items[0]).not.toHaveProperty("budgetId");
    expect(snapshot.items[0]?.apu?.resources[0]?.resource).toMatchObject({
      code: "MO-001",
      description: "Operario",
      category: "LABOR",
      unit: "hh",
      unitPrice: 18.5,
      currency: "PEN",
    });
  });

  it("rebuilds a budget draft from a snapshot with fresh ids and calculated totals", () => {
    const snapshot = buildBudgetTemplateSnapshot(createBudget(), {
      capturedAt: "2026-05-29T22:00:00.000Z",
      name: "Arquitectura base",
    });
    const draft = buildBudgetFromTemplateSnapshot(snapshot, {
      budgetId: "new-budget",
      projectId: "new-project",
      name: "Arquitectura aplicada",
      nextId: (scope, index) => `${scope}-${index}`,
    });

    expect(draft).toMatchObject({
      id: "new-budget",
      projectId: "new-project",
      parentBudgetId: null,
      name: "Arquitectura aplicada",
      currency: "PEN",
      totalDirectCost: 623.7063,
      totalAmount: 868.4487,
    });
    expect(draft.levels).toEqual([
      expect.objectContaining({ id: "level-0", budgetId: "new-budget", parentId: null, code: "01" }),
      expect.objectContaining({ id: "level-1", budgetId: "new-budget", parentId: "level-0", code: "01.01" }),
    ]);
    expect(draft.items[0]).toMatchObject({
      id: "item-0",
      budgetId: "new-budget",
      levelId: "level-1",
      apu: expect.objectContaining({
        id: "apu-0",
        budgetItemId: "item-0",
        resources: [expect.objectContaining({ id: "apuResource-0", apuId: "apu-0" })],
      }),
    });
  });

  it("uses deterministic defaults when optional template metadata is omitted", () => {
    const snapshot = buildBudgetTemplateSnapshot(createBudget(), {
      capturedAt: new Date("2026-05-29T22:00:00.000Z"),
    });

    expect(snapshot.name).toBe("Plantilla de Arquitectura");
    expect(snapshot.description).toBe("");
    expect(snapshot.source.capturedAt).toBe("2026-05-29T22:00:00.000Z");
  });
});

function createBudget(): BudgetRecord {
  return {
    id: "budget-1",
    projectId: "project-1",
    parentBudgetId: null,
    kind: "SUB_BUDGET",
    name: "Arquitectura",
    currency: "PEN",
    igvRate: 0.18,
    generalExpensesRate: 0.1,
    utilityRate: 0.08,
    totalDirectCost: 0,
    totalGeneralExpenses: 0,
    totalUtility: 0,
    totalTax: 0,
    totalAmount: 0,
    levels: [
      {
        id: "subtitle-1",
        budgetId: "budget-1",
        parentId: "title-1",
        type: "SUBTITLE",
        code: "01.01",
        name: "Muros",
        sortOrder: 2,
      },
      {
        id: "title-1",
        budgetId: "budget-1",
        parentId: null,
        type: "TITLE",
        code: "01",
        name: "Arquitectura",
        sortOrder: 1,
      },
    ],
    items: [
      {
        id: "item-2",
        budgetId: "budget-1",
        levelId: "subtitle-1",
        code: "01.01.02",
        description: "Tarrajeo interior",
        unit: "m2",
        quantity: 3.3333,
        unitPrice: 150.1234,
        partial: 0,
        sortOrder: 2,
      },
      {
        id: "item-1",
        budgetId: "budget-1",
        levelId: "subtitle-1",
        code: "01.01.01",
        description: "Muro de ladrillo",
        unit: "m2",
        quantity: 10,
        unitPrice: 95,
        partial: 0,
        sortOrder: 1,
        apu: {
          id: "apu-1",
          budgetItemId: "item-1",
          name: "Muro de ladrillo",
          unit: "m2",
          performance: 12,
          totalUnitCost: 95,
          resources: [
            {
              id: "apu-resource-1",
              apuId: "apu-1",
              resourceId: "resource-1",
              resourceType: "LABOR",
              crew: 1,
              quantity: 0.5,
              unitPrice: 18.5,
              subtotal: 0,
              resource: {
                id: "resource-1",
                code: "MO-001",
                description: "Operario",
                category: "LABOR",
                unit: "hh",
                unitPrice: 18.5,
                currency: "PEN",
              },
            },
          ],
        },
      },
    ],
  };
}
