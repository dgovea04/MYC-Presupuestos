import { describe, expect, it } from "vitest";
import type { WorkScheduleViewRecord, WorkScheduleLineRecord } from "@/types/work-schedule";
import { buildWorkScheduleView } from "@/lib/calculations/work-schedule";
import { buildPreviewWorkScheduleView } from "@/components/budget/work-schedule-page-content";
import type { EditableLine } from "@/components/budget/work-schedule/types";

function buildLine(overrides: Partial<WorkScheduleLineRecord> & { budgetItemId: string; itemCode: string }): WorkScheduleLineRecord {
  return {
    description: "Test line",
    unit: "UND",
    quantity: 1,
    unitPrice: 100,
    partial: 100,
    subBudgetId: "sub-1",
    subBudgetName: "Test",
    monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
    ...overrides,
  };
}

function buildTestData(lines: WorkScheduleLineRecord[]): WorkScheduleViewRecord {
  const base = buildWorkScheduleView(
    {
      budgetId: "budget-1",
      budgetName: "Presupuesto Test",
      projectName: "Proyecto Test",
      currency: "PEN",
      lines,
    },
    { includeDerivedCalendars: false },
  );

  return {
    ...base,
    groups: lines.length > 0
      ? [
          {
            subBudgetId: "sub-1",
            subBudgetName: "Test",
            totalAmount: lines.reduce((sum, l) => sum + l.partial, 0),
            lines,
            rows: lines.map((line) => ({ kind: "line" as const, rowId: line.budgetItemId, line })),
          },
        ]
      : [],
  };
}

describe("buildPreviewWorkScheduleView", () => {
  it("updates the dragged line dates in the preview", () => {
    const lines = [
      buildLine({
        budgetItemId: "item-A",
        itemCode: "A",
        startDate: "2026-03-01",
        endDate: "2026-03-10",
        durationDays: 10,
      }),
    ];

    const data = buildTestData(lines);
    const draft: Record<string, EditableLine> = {
      ["item-A"]: {
        budgetItemId: "item-A",
        itemCode: "A",
        description: "Partida A",
        quantity: 1,
        unit: "UND",
        unitPrice: 100,
        partial: 100,
        subBudgetId: "sub-1",
        subBudgetName: "Test",
        performance: null,
        startDate: "2026-03-05",
        endDate: "2026-03-14",
        durationDays: 10,
        predecessor: "",
        crew: "1",
        monthlyDistributions: [
          { year: 2026, month: 3, percentage: 100 },
        ],
        isMilestone: false,
        baselineStartDate: null,
        baselineEndDate: null,
        actualStartDate: null,
        actualEndDate: null,
        percentComplete: null,
      },
    };

    const result = buildPreviewWorkScheduleView({
      data,
      editingLine: null,
      inlineDrafts: draft,
      rowNumberToItemCode: new Map(),
    });

    expect(result).not.toBeNull();
    const resultLineA = result!.groups
      .flatMap((g) => g.lines)
      .find((l) => l.budgetItemId === "item-A");

    expect(resultLineA).toBeDefined();
    expect(resultLineA?.startDate).toBe("2026-03-05");
    expect(resultLineA?.endDate).toBe("2026-03-14");
  });

  it("recalculates successor dates when predecessor is dragged", () => {
    const lines = [
      buildLine({
        budgetItemId: "item-A",
        itemCode: "A",
        description: "Partida A (predecesora)",
        startDate: "2026-03-01",
        endDate: "2026-03-10",
        durationDays: 10,
      }),
      buildLine({
        budgetItemId: "item-B",
        itemCode: "B",
        description: "Partida B (sucesora)",
        startDate: "2026-03-08",
        endDate: "2026-03-15",
        durationDays: 8,
        predecessor: "AFS",
      }),
    ];

    const data = buildTestData(lines);
    const draft: Record<string, EditableLine> = {
      ["item-A"]: {
        budgetItemId: "item-A",
        itemCode: "A",
        description: "Partida A",
        quantity: 1,
        unit: "UND",
        unitPrice: 100,
        partial: 100,
        subBudgetId: "sub-1",
        subBudgetName: "Test",
        performance: null,
        startDate: "2026-03-05",
        endDate: "2026-03-14",
        durationDays: 10,
        predecessor: "",
        crew: "1",
        monthlyDistributions: [
          { year: 2026, month: 3, percentage: 100 },
        ],
        isMilestone: false,
        baselineStartDate: null,
        baselineEndDate: null,
        actualStartDate: null,
        actualEndDate: null,
        percentComplete: null,
      },
    };

    const result = buildPreviewWorkScheduleView({
      data,
      editingLine: null,
      inlineDrafts: draft,
      rowNumberToItemCode: new Map(),
    });

    expect(result).not.toBeNull();
    const resultLineA = result!.groups
      .flatMap((g) => g.lines)
      .find((l) => l.budgetItemId === "item-A");
    const resultLineB = result!.groups
      .flatMap((g) => g.lines)
      .find((l) => l.budgetItemId === "item-B");

    // Line A should have new dates (from drag)
    expect(resultLineA).toBeDefined();
    expect(resultLineA?.startDate).toBe("2026-03-05");
    expect(resultLineA?.endDate).toBe("2026-03-14");

    // Line B follows the edited predecessor through its finish-to-start dependency.
    expect(resultLineB).toBeDefined();
    expect(resultLineB?.startDate).toBe("2026-03-15");
    expect(resultLineB?.endDate).toBe("2026-03-22");
    expect(resultLineB?.durationDays).toBe(8);
  });

  it("recalculates successor dates in a chain (A->B->C)", () => {
    const lines = [
      buildLine({
        budgetItemId: "item-A",
        itemCode: "A",
        description: "Partida A",
        startDate: "2026-03-01",
        endDate: "2026-03-08",
        durationDays: 8,
      }),
      buildLine({
        budgetItemId: "item-B",
        itemCode: "B",
        description: "Partida B (sucesora de A)",
        startDate: "2026-03-04",
        endDate: "2026-03-06",
        durationDays: 3,
        predecessor: "AFS",
      }),
      buildLine({
        budgetItemId: "item-C",
        itemCode: "C",
        description: "Partida C (sucesora de B)",
        startDate: "2026-03-05",
        endDate: "2026-03-06",
        durationDays: 2,
        predecessor: "BFS",
      }),
    ];

    const data = buildTestData(lines);
    const draft: Record<string, EditableLine> = {
      ["item-A"]: {
        budgetItemId: "item-A",
        itemCode: "A",
        description: "Partida A",
        quantity: 1,
        unit: "UND",
        unitPrice: 100,
        partial: 100,
        subBudgetId: "sub-1",
        subBudgetName: "Test",
        performance: null,
        startDate: "2026-03-10",
        endDate: "2026-03-17",
        durationDays: 8,
        predecessor: "",
        crew: "1",
        monthlyDistributions: [
          { year: 2026, month: 3, percentage: 100 },
        ],
        isMilestone: false,
        baselineStartDate: null,
        baselineEndDate: null,
        actualStartDate: null,
        actualEndDate: null,
        percentComplete: null,
      },
    };

    const result = buildPreviewWorkScheduleView({
      data,
      editingLine: null,
      inlineDrafts: draft,
      rowNumberToItemCode: new Map(),
    });

    expect(result).not.toBeNull();
    const resultLineA = result!.groups
      .flatMap((g) => g.lines)
      .find((l) => l.budgetItemId === "item-A");
    const resultLineB = result!.groups
      .flatMap((g) => g.lines)
      .find((l) => l.budgetItemId === "item-B");
    const resultLineC = result!.groups
      .flatMap((g) => g.lines)
      .find((l) => l.budgetItemId === "item-C");

    expect(resultLineA?.startDate).toBe("2026-03-10");
    expect(resultLineA?.endDate).toBe("2026-03-17");

    // B and C follow the edited predecessor chain through their dependencies.
    expect(resultLineB?.startDate).toBe("2026-03-18");
    expect(resultLineB?.endDate).toBe("2026-03-20");
    expect(resultLineC?.startDate).toBe("2026-03-21");
    expect(resultLineC?.endDate).toBe("2026-03-22");
  });

  it("returns null when there are no drafts or editing lines", () => {
    const lines = [
      buildLine({
        budgetItemId: "item-A",
        itemCode: "A",
        startDate: "2026-03-01",
        endDate: "2026-03-10",
        durationDays: 10,
      }),
    ];

    const data = buildTestData(lines);

    const result = buildPreviewWorkScheduleView({
      data,
      editingLine: null,
      inlineDrafts: {},
      rowNumberToItemCode: new Map(),
    });

    expect(result).toBeNull();
  });
});
