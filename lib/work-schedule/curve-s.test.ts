import { describe, expect, it } from "vitest";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";
import { buildPlannedVsActualCurveSeries } from "./curve-s";

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
    endDate: "2026-03-31",
    durationDays: 31,
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

describe("buildPlannedVsActualCurveSeries", () => {
  it("returns empty series for empty lines", () => {
    const result = buildPlannedVsActualCurveSeries({ lines: [], periods: [] });
    expect(result).toEqual([]);
  });

  it("returns a complete single-month line", () => {
    const line = createLine({
      partial: 1000,
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
    });
    const result = buildPlannedVsActualCurveSeries({
      lines: [line],
      periods: [{ year: 2026, month: 3 }],
    });
    expect(result).toEqual([{ period: "2026-03", plannedPercent: 100, actualPercent: 0 }]);
  });

  it("returns a partial line with percentComplete = 50", () => {
    const line = createLine({
      partial: 1000,
      percentComplete: 50,
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
    });
    const result = buildPlannedVsActualCurveSeries({
      lines: [line],
      periods: [{ year: 2026, month: 3 }],
    });
    expect(result).toEqual([{ period: "2026-03", plannedPercent: 100, actualPercent: 50 }]);
  });

  it("handles multi-month distributions", () => {
    const line = createLine({
      partial: 1000,
      percentComplete: 50,
      startDate: "2026-03-01",
      endDate: "2026-04-30",
      monthlyDistributions: [
        { year: 2026, month: 3, percentage: 60 },
        { year: 2026, month: 4, percentage: 40 },
      ],
    });
    const result = buildPlannedVsActualCurveSeries({
      lines: [line],
      periods: [
        { year: 2026, month: 3 },
        { year: 2026, month: 4 },
      ],
    });
    expect(result[0].plannedPercent).toBeCloseTo(60, 10);
    expect(result[0].actualPercent).toBeCloseTo(30, 10);
    expect(result[1].plannedPercent).toBe(100);
    expect(result[1].actualPercent).toBe(50);
  });

  it("uses fallback range when no distributions are provided", () => {
    const line = createLine({
      partial: 1000,
      percentComplete: 100,
      startDate: "2026-03-01",
      endDate: "2026-04-30",
    });
    const result = buildPlannedVsActualCurveSeries({
      lines: [line],
      periods: [
        { year: 2026, month: 3 },
        { year: 2026, month: 4 },
      ],
    });
    expect(result[0].plannedPercent).toBeCloseTo(50, 10);
    expect(result[0].actualPercent).toBeCloseTo(50, 10);
    expect(result[1].plannedPercent).toBe(100);
    expect(result[1].actualPercent).toBe(100);
  });
});
