import { describe, expect, it } from "vitest";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";
import { buildWorkScheduleReschedulePreview } from "./rescheduling";

function createLine(partial: Partial<WorkScheduleLineRecord> = {}): WorkScheduleLineRecord {
  return {
    budgetItemId: "item-1",
    itemCode: "01.01",
    description: "Excavacion",
    unit: "m3",
    quantity: 100,
    unitPrice: 25,
    partial: 2500,
    subBudgetId: "sub-1",
    subBudgetName: "Estructuras",
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    durationDays: 5,
    predecessor: "",
    monthlyDistributions: [],
    resourceIds: [],
    resources: [],
    isMilestone: false,
    baselineStartDate: null,
    baselineEndDate: null,
    actualStartDate: null,
    actualEndDate: null,
    percentComplete: null,
    criticalPath: null,
    ...partial,
  };
}

describe("buildWorkScheduleReschedulePreview", () => {
  it("returns empty impacts when there are no dependents", () => {
    const line = createLine({ budgetItemId: "item-1", itemCode: "01.01", predecessor: "" });
    const result = buildWorkScheduleReschedulePreview({
      lines: [line],
      changedBudgetItemId: "item-1",
    });
    expect(result).toEqual([]);
  });

  it("returns FS dependent impact when predecessor moves", () => {
    const predecessor = createLine({
      budgetItemId: "item-1",
      itemCode: "01.01",
      startDate: "2026-03-01",
      endDate: "2026-03-10",
    });
    const dependent = createLine({
      budgetItemId: "item-2",
      itemCode: "01.02",
      startDate: "2026-03-06",
      endDate: "2026-03-10",
      predecessor: "01.01FS",
    });

    const result = buildWorkScheduleReschedulePreview({
      lines: [predecessor, dependent],
      changedBudgetItemId: "item-1",
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].budgetItemId).toBe("item-2");
  });

  it("omits unchanged dependents", () => {
    const predecessor = createLine({
      budgetItemId: "item-1",
      itemCode: "01.01",
      startDate: "2026-03-01",
      endDate: "2026-03-05",
    });
    const dependent = createLine({
      budgetItemId: "item-2",
      itemCode: "01.02",
      startDate: "2026-03-06",
      endDate: "2026-03-10",
      predecessor: "01.01FS+10d",
    });

    const result = buildWorkScheduleReschedulePreview({
      lines: [predecessor, dependent],
      changedBudgetItemId: "item-1",
    });

    expect(result.some((impact) => impact.budgetItemId === "item-2")).toBe(true);
  });

  it("marks critical dependents", () => {
    const predecessor = createLine({
      budgetItemId: "item-1",
      itemCode: "01.01",
      startDate: "2026-03-01",
      endDate: "2026-03-10",
    });
    const dependent = createLine({
      budgetItemId: "item-2",
      itemCode: "01.02",
      startDate: "2026-03-06",
      endDate: "2026-03-10",
      predecessor: "01.01FS",
      criticalPath: {
        earlyStartDay: 1,
        earlyFinishDay: 5,
        lateStartDay: 1,
        lateFinishDay: 5,
        totalSlackDays: 0,
        isCritical: true,
      },
    });

    const result = buildWorkScheduleReschedulePreview({
      lines: [predecessor, dependent],
      changedBudgetItemId: "item-1",
    });

    const impact = result.find((i) => i.budgetItemId === "item-2");
    expect(impact?.isCritical).toBe(true);
  });
});
