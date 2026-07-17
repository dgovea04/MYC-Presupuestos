import { describe, expect, it } from "vitest";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";
import { calculateWorkScheduleProgressSummary, detectWorkScheduleDeviations } from "./progress";

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

describe("calculateWorkScheduleProgressSummary", () => {
  it("returns zero summary for empty lines", () => {
    const summary = calculateWorkScheduleProgressSummary({ lines: [], asOfDate: "2026-03-15" });
    expect(summary.plannedPercent).toBe(0);
    expect(summary.actualPercent).toBe(0);
    expect(summary.variancePoints).toBe(0);
    expect(summary.status).toBe("not_started");
  });

  it("returns actual progress for a completed line", () => {
    const line = createLine({
      partial: 1000,
      percentComplete: 100,
      startDate: "2026-03-01",
      endDate: "2026-03-10",
    });
    const summary = calculateWorkScheduleProgressSummary({ lines: [line], asOfDate: "2026-03-15" });
    expect(summary.actualPercent).toBe(100);
    expect(summary.status).toBe("on_track");
  });

  it("uses partial * percentComplete / 100 for partial progress", () => {
    const line = createLine({
      partial: 1000,
      percentComplete: 50,
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    });
    const summary = calculateWorkScheduleProgressSummary({ lines: [line], asOfDate: "2026-03-31" });
    expect(summary.actualPercent).toBe(50);
  });

  it("returns behind status when actual is more than 5 points under planned", () => {
    const line = createLine({
      partial: 1000,
      percentComplete: 10,
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    });
    const summary = calculateWorkScheduleProgressSummary({ lines: [line], asOfDate: "2026-03-31" });
    expect(summary.status).toBe("behind");
  });

  it("returns ahead status when actual is more than 5 points above planned", () => {
    const line = createLine({
      partial: 1000,
      percentComplete: 100,
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    });
    const summary = calculateWorkScheduleProgressSummary({ lines: [line], asOfDate: "2026-03-15" });
    expect(summary.status).toBe("ahead");
  });
});

describe("detectWorkScheduleDeviations", () => {
  it("detects missing actual progress", () => {
    const line = createLine({
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      percentComplete: 0,
    });
    const deviations = detectWorkScheduleDeviations({ lines: [line], asOfDate: "2026-03-15" });
    expect(deviations.some((d) => d.kind === "missing_actual_progress")).toBe(true);
  });

  it("detects late finish", () => {
    const line = createLine({
      endDate: "2026-03-10",
      actualEndDate: "2026-03-15",
      percentComplete: 100,
    });
    const deviations = detectWorkScheduleDeviations({ lines: [line], asOfDate: "2026-03-15" });
    expect(deviations.some((d) => d.kind === "late")).toBe(true);
  });

  it("detects ahead finish", () => {
    const line = createLine({
      endDate: "2026-03-15",
      actualEndDate: "2026-03-10",
      percentComplete: 100,
    });
    const deviations = detectWorkScheduleDeviations({ lines: [line], asOfDate: "2026-03-15" });
    expect(deviations.some((d) => d.kind === "ahead")).toBe(true);
  });

  it("detects critical low progress", () => {
    const line = createLine({
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      percentComplete: 10,
      criticalPath: {
        earlyStartDay: 1,
        earlyFinishDay: 31,
        lateStartDay: 1,
        lateFinishDay: 31,
        totalSlackDays: 0,
        isCritical: true,
      },
    });
    const deviations = detectWorkScheduleDeviations({ lines: [line], asOfDate: "2026-03-31" });
    expect(deviations.some((d) => d.kind === "critical_low_progress")).toBe(true);
  });

  it("detects baseline variance", () => {
    const line = createLine({
      startDate: "2026-03-05",
      endDate: "2026-03-31",
      baselineStartDate: "2026-03-01",
      baselineEndDate: "2026-03-31",
    });
    const deviations = detectWorkScheduleDeviations({ lines: [line], asOfDate: "2026-03-15" });
    expect(deviations.some((d) => d.kind === "baseline_variance")).toBe(true);
  });
});
