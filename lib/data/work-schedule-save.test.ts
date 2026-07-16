import { describe, expect, it } from "vitest";
import { buildCascadedWorkScheduleSuccessorUpdates } from "@/lib/data/work-schedule";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";

function createLine(overrides: Partial<WorkScheduleLineRecord> & Pick<WorkScheduleLineRecord, "budgetItemId" | "itemCode" | "description">): WorkScheduleLineRecord {
  return {
    budgetItemId: overrides.budgetItemId,
    itemCode: overrides.itemCode,
    description: overrides.description,
    unit: overrides.unit ?? "M2",
    quantity: overrides.quantity ?? 1,
    unitPrice: overrides.unitPrice ?? 1,
    partial: overrides.partial ?? 1,
    subBudgetId: overrides.subBudgetId ?? "sub-1",
    subBudgetName: overrides.subBudgetName ?? "Estructuras",
    startDate: overrides.startDate ?? null,
    endDate: overrides.endDate ?? null,
    durationDays: overrides.durationDays ?? null,
    predecessor: overrides.predecessor ?? null,
    crew: overrides.crew ?? 1,
    performance: overrides.performance ?? 1,
    monthlyDistributions: overrides.monthlyDistributions ?? [{ year: 2026, month: 3, percentage: 100 }],
  };
}

describe("buildCascadedWorkScheduleSuccessorUpdates", () => {
  it("returns chained successors that must be re-persisted after a predecessor resize", () => {
    const lines: WorkScheduleLineRecord[] = [
      createLine({
        budgetItemId: "item-1",
        itemCode: "01.01",
        description: "Predecesora",
        startDate: "2026-03-01",
        endDate: "2026-03-10",
        durationDays: 10,
      }),
      createLine({
        budgetItemId: "item-2",
        itemCode: "01.02",
        description: "Sucesora directa",
        startDate: "2026-03-06",
        endDate: "2026-03-08",
        durationDays: 3,
        predecessor: "01.01FS",
      }),
      createLine({
        budgetItemId: "item-3",
        itemCode: "01.03",
        description: "Sucesora en cadena",
        startDate: "2026-03-09",
        endDate: "2026-03-10",
        durationDays: 2,
        predecessor: "01.02FS",
      }),
    ];

    const result = buildCascadedWorkScheduleSuccessorUpdates(lines, "item-1");

    expect(result).toEqual([
      {
        budgetItemId: "item-2",
        startDate: "2026-03-11",
        endDate: "2026-03-13",
        durationDays: 3,
        monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
      },
      {
        budgetItemId: "item-3",
        startDate: "2026-03-14",
        endDate: "2026-03-15",
        durationDays: 2,
        monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
      },
    ]);
  });

  it("detects moved successors from the current persisted state", () => {
    const lines: WorkScheduleLineRecord[] = [
      createLine({
        budgetItemId: "item-1",
        itemCode: "01.01",
        description: "Predecesora",
        startDate: "2026-03-01",
        endDate: "2026-03-10",
        durationDays: 10,
      }),
      createLine({
        budgetItemId: "item-2",
        itemCode: "01.02",
        description: "Sucesora directa",
        startDate: "2026-03-06",
        endDate: "2026-03-08",
        durationDays: 3,
        predecessor: "01.01FS",
      }),
      createLine({
        budgetItemId: "item-3",
        itemCode: "01.03",
        description: "Sin dependencia",
        startDate: "2026-03-02",
        endDate: "2026-03-03",
        durationDays: 2,
      }),
    ];

    const result = buildCascadedWorkScheduleSuccessorUpdates(lines, "item-1");

    expect(result).toEqual([
      {
        budgetItemId: "item-2",
        startDate: "2026-03-11",
        endDate: "2026-03-13",
        durationDays: 3,
        monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
      },
    ]);
  });
});
