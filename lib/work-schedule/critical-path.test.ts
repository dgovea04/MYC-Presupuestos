import { describe, expect, it } from "vitest";
import { calculateWorkScheduleCriticalPath } from "@/lib/work-schedule/critical-path";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";

function line(overrides: Partial<WorkScheduleLineRecord> & Pick<WorkScheduleLineRecord, "budgetItemId" | "itemCode">): WorkScheduleLineRecord {
  return {
    description: overrides.description ?? overrides.itemCode,
    unit: "UND",
    quantity: 1,
    unitPrice: 1,
    partial: 1,
    subBudgetId: "sub-1",
    subBudgetName: "General",
    durationDays: overrides.durationDays ?? 1,
    predecessor: overrides.predecessor ?? null,
    monthlyDistributions: [],
    ...overrides,
  };
}

describe("calculateWorkScheduleCriticalPath", () => {
  it("marks a full finish-to-start chain as critical with zero total slack", () => {
    const result = calculateWorkScheduleCriticalPath([
      line({ budgetItemId: "a", itemCode: "01", durationDays: 3 }),
      line({ budgetItemId: "b", itemCode: "02", durationDays: 4, predecessor: "01FS" }),
      line({ budgetItemId: "c", itemCode: "03", durationDays: 2, predecessor: "02FS" }),
    ]);

    expect(result.status).toBe("calculated");
    expect(result.projectDurationDays).toBe(9);
    expect(result.itemsByBudgetItemId.get("a")).toMatchObject({ earlyStartDay: 0, earlyFinishDay: 2, totalSlackDays: 0, isCritical: true });
    expect(result.itemsByBudgetItemId.get("b")).toMatchObject({ earlyStartDay: 3, earlyFinishDay: 6, totalSlackDays: 0, isCritical: true });
    expect(result.itemsByBudgetItemId.get("c")).toMatchObject({ earlyStartDay: 7, earlyFinishDay: 8, totalSlackDays: 0, isCritical: true });
  });

  it("keeps parallel work off the critical path when it has total slack", () => {
    const result = calculateWorkScheduleCriticalPath([
      line({ budgetItemId: "a", itemCode: "01", durationDays: 5 }),
      line({ budgetItemId: "b", itemCode: "02", durationDays: 2 }),
      line({ budgetItemId: "c", itemCode: "03", durationDays: 1, predecessor: "01FS,02FS" }),
    ]);

    expect(result.status).toBe("calculated");
    expect(result.itemsByBudgetItemId.get("a")).toMatchObject({ totalSlackDays: 0, isCritical: true });
    expect(result.itemsByBudgetItemId.get("b")).toMatchObject({ totalSlackDays: 3, isCritical: false });
    expect(result.itemsByBudgetItemId.get("c")).toMatchObject({ totalSlackDays: 0, isCritical: true });
  });

  it("supports MS Project-style SS, FF, SF relations and lag days", () => {
    const result = calculateWorkScheduleCriticalPath([
      line({ budgetItemId: "a", itemCode: "01", durationDays: 5 }),
      line({ budgetItemId: "b", itemCode: "02", durationDays: 4, predecessor: "01SS+2d" }),
      line({ budgetItemId: "c", itemCode: "03", durationDays: 3, predecessor: "02FF+1d" }),
      line({ budgetItemId: "d", itemCode: "04", durationDays: 2, predecessor: "03SF+1d" }),
    ]);

    expect(result.status).toBe("calculated");
    expect(result.itemsByBudgetItemId.get("b")).toMatchObject({ earlyStartDay: 2, earlyFinishDay: 5 });
    expect(result.itemsByBudgetItemId.get("c")).toMatchObject({ earlyStartDay: 4, earlyFinishDay: 6 });
    expect(result.itemsByBudgetItemId.get("d")).toMatchObject({ earlyStartDay: 4, earlyFinishDay: 5, totalSlackDays: 1, isCritical: false });
  });

  it("reports cycles without returning misleading critical flags", () => {
    const result = calculateWorkScheduleCriticalPath([
      line({ budgetItemId: "a", itemCode: "01", durationDays: 2, predecessor: "02FS" }),
      line({ budgetItemId: "b", itemCode: "02", durationDays: 2, predecessor: "01FS" }),
    ]);

    expect(result.status).toBe("cycle");
    expect(result.itemsByBudgetItemId.size).toBe(0);
    expect(result.issues).toEqual(["El cronograma contiene un ciclo de predecesoras"]);
  });
});
