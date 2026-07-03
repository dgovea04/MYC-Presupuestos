import { describe, expect, it } from "vitest";
import {
  analyzeWorkScheduleScale,
  buildWorkScheduleCurveSeries,
  buildWorkScheduleMonthlyDistributionsFromRange,
  buildWorkScheduleResourceCalendar,
  buildWorkScheduleValuationCalendarSlice,
  buildWorkScheduleValuationCalendar,
  buildWorkScheduleView,
  calculateWorkScheduleDurationDays,
  hasSuspiciousDefaultWorkSchedulePerformance,
  recalculateDependentWorkScheduleLines,
  recalculateWorkScheduleLineFromPredecessors,
  validateWorkScheduleInput,
} from "@/lib/calculations/work-schedule";

describe("validateWorkScheduleInput", () => {
  it("rejects monthly distributions that do not sum to one hundred percent", () => {
    expect(() =>
      validateWorkScheduleInput({
        startDate: "2026-03-01",
        endDate: "2026-04-30",
        durationDays: 61,
        monthlyDistributions: [
          { year: 2026, month: 3, percentage: 60 },
          { year: 2026, month: 4, percentage: 35 },
        ],
      }),
    ).toThrow("La distribucion mensual debe cerrar en 100.0000%");
  });

  it("rejects inconsistent date ranges and durations", () => {
    expect(() =>
      validateWorkScheduleInput({
        startDate: "2026-03-10",
        endDate: "2026-03-01",
        durationDays: 5,
        monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
      }),
    ).toThrow("La fecha de fin no puede ser menor a la fecha de inicio");

    expect(() =>
      validateWorkScheduleInput({
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        durationDays: 3,
        monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
      }),
    ).toThrow("La duracion no coincide con el rango entre inicio y fin");
  });
});

describe("calculateWorkScheduleDurationDays", () => {
  it("calculates duration from quantity, performance and schedule crew", () => {
    expect(
      calculateWorkScheduleDurationDays({
        quantity: 10,
        performance: 2,
        crew: 5,
      }),
    ).toBe(1);
  });

  it("returns null when crew or performance are missing or invalid", () => {
    expect(
      calculateWorkScheduleDurationDays({
        quantity: 10,
        performance: 2,
        crew: null,
      }),
    ).toBeNull();

    expect(
      calculateWorkScheduleDurationDays({
        quantity: 10,
        performance: 0,
        crew: 1,
      }),
    ).toBeNull();
  });
});

describe("hasSuspiciousDefaultWorkSchedulePerformance", () => {
  it("flags metric-style units when the performance is the technical default 1", () => {
    expect(hasSuspiciousDefaultWorkSchedulePerformance({ performance: 1, unit: "m2", quantity: 20 })).toBe(true);
    expect(hasSuspiciousDefaultWorkSchedulePerformance({ performance: 1, unit: "kg", quantity: 20 })).toBe(true);
  });

  it("flags very large quantities even for other units when the technical default is still 1", () => {
    expect(hasSuspiciousDefaultWorkSchedulePerformance({ performance: 1, unit: "pto", quantity: 366 })).toBe(true);
  });

  it("does not flag other units with smaller quantities or explicit performance values", () => {
    expect(hasSuspiciousDefaultWorkSchedulePerformance({ performance: 1, unit: "und", quantity: 50 })).toBe(false);
    expect(hasSuspiciousDefaultWorkSchedulePerformance({ performance: 2, unit: "m2", quantity: 500 })).toBe(false);
    expect(hasSuspiciousDefaultWorkSchedulePerformance({ performance: null, unit: "m2", quantity: 500 })).toBe(false);
  });
});

describe("recalculateDependentWorkScheduleLines", () => {
  it("moves FS successors forward when a predecessor duration pushes its end date", () => {
    const result = recalculateDependentWorkScheduleLines(
      [
        {
          budgetItemId: "item-1",
          itemCode: "01.01",
          description: "Predecesora",
          unit: "M2",
          quantity: 10,
          unitPrice: 1,
          partial: 10,
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          startDate: "2026-03-01",
          endDate: "2026-03-10",
          durationDays: 10,
          monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
        },
        {
          budgetItemId: "item-2",
          itemCode: "01.02",
          description: "Sucesora",
          unit: "M2",
          quantity: 10,
          unitPrice: 1,
          partial: 10,
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          startDate: "2026-03-06",
          endDate: "2026-03-10",
          durationDays: 5,
          predecessor: "01.01FS",
          monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
        },
      ],
      "item-1",
    );

    expect(result[1]).toMatchObject({
      budgetItemId: "item-2",
      startDate: "2026-03-11",
      endDate: "2026-03-15",
      durationDays: 5,
    });
  });

  it("propagates recalculated starts through chained dependencies", () => {
    const result = recalculateDependentWorkScheduleLines(
      [
        {
          budgetItemId: "item-1",
          itemCode: "01.01",
          description: "A",
          unit: "M2",
          quantity: 10,
          unitPrice: 1,
          partial: 10,
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          startDate: "2026-03-01",
          endDate: "2026-03-08",
          durationDays: 8,
          monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
        },
        {
          budgetItemId: "item-2",
          itemCode: "01.02",
          description: "B",
          unit: "M2",
          quantity: 10,
          unitPrice: 1,
          partial: 10,
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          startDate: "2026-03-04",
          endDate: "2026-03-06",
          durationDays: 3,
          predecessor: "01.01FS",
          monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
        },
        {
          budgetItemId: "item-3",
          itemCode: "01.03",
          description: "C",
          unit: "M2",
          quantity: 10,
          unitPrice: 1,
          partial: 10,
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          startDate: "2026-03-05",
          endDate: "2026-03-06",
          durationDays: 2,
          predecessor: "01.02FS",
          monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
        },
      ],
      "item-1",
    );

    expect(result[1]).toMatchObject({
      budgetItemId: "item-2",
      startDate: "2026-03-09",
      endDate: "2026-03-11",
    });
    expect(result[2]).toMatchObject({
      budgetItemId: "item-3",
      startDate: "2026-03-12",
      endDate: "2026-03-13",
      monthlyDistributions: buildWorkScheduleMonthlyDistributionsFromRange("2026-03-12", "2026-03-13"),
    });
  });
});

describe("recalculateWorkScheduleLineFromPredecessors", () => {
  it("recalculates a line from its own predecessor constraints", () => {
    const predecessor = {
      budgetItemId: "item-1",
      itemCode: "01.01",
      description: "Predecesora",
      unit: "M2",
      quantity: 10,
      unitPrice: 1,
      partial: 10,
      subBudgetId: "sub-1",
      subBudgetName: "Estructuras",
      startDate: "2026-03-01",
      endDate: "2026-03-05",
      durationDays: 5,
      monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
    };
    const successor = {
      budgetItemId: "item-2",
      itemCode: "01.02",
      description: "Sucesora",
      unit: "M2",
      quantity: 10,
      unitPrice: 1,
      partial: 10,
      subBudgetId: "sub-1",
      subBudgetName: "Estructuras",
      startDate: "2026-03-06",
      endDate: "2026-03-08",
      durationDays: 3,
      predecessor: "01.01FS+2d",
      monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
    };

    expect(
      recalculateWorkScheduleLineFromPredecessors(
        successor,
        new Map([
          [predecessor.itemCode, predecessor],
          [successor.itemCode, successor],
        ]),
      ),
    ).toEqual({
      startDate: "2026-03-08",
      endDate: "2026-03-10",
      durationDays: 3,
      monthlyDistributions: buildWorkScheduleMonthlyDistributionsFromRange("2026-03-08", "2026-03-10"),
    });
  });
});

describe("buildWorkScheduleValuationCalendar", () => {
  it("distributes each partida partial into monthly valued amounts using decimal-safe math", () => {
    const result = buildWorkScheduleValuationCalendar({
      currency: "PEN",
      lines: [
        {
          scheduleItemId: "ws-1",
          budgetItemId: "item-1",
          itemCode: "01.01",
          description: "Trazo y replanteo",
          unit: "GLB",
          quantity: 1,
          unitPrice: 1000,
          partial: 1000,
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          monthlyDistributions: [
            { year: 2026, month: 3, percentage: 33.3333 },
            { year: 2026, month: 4, percentage: 33.3333 },
            { year: 2026, month: 5, percentage: 33.3334 },
          ],
        },
      ],
    });

    expect(result.periods).toEqual([
      { year: 2026, month: 3, key: "2026-03" },
      { year: 2026, month: 4, key: "2026-04" },
      { year: 2026, month: 5, key: "2026-05" },
    ]);
    expect(result.rows[0]).toMatchObject({
      budgetItemId: "item-1",
      partial: 1000,
      periodAmounts: {
        "2026-03": 333.333,
        "2026-04": 333.333,
        "2026-05": 333.334,
      },
    });
    expect(result.rows[0]?.rowTotal).toBe(1000);
  });

  it("can build a valuation slice constrained to a monthly range", () => {
    const result = buildWorkScheduleValuationCalendarSlice({
      currency: "PEN",
      lines: [
        {
          scheduleItemId: "ws-1",
          budgetItemId: "item-1",
          itemCode: "01.01",
          description: "Trazo y replanteo",
          unit: "GLB",
          quantity: 1,
          unitPrice: 1000,
          partial: 1000,
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          monthlyDistributions: [
            { year: 2026, month: 3, percentage: 20 },
            { year: 2026, month: 4, percentage: 30 },
            { year: 2026, month: 5, percentage: 50 },
          ],
        },
        {
          scheduleItemId: "ws-2",
          budgetItemId: "item-2",
          itemCode: "01.02",
          description: "Excavacion",
          unit: "M3",
          quantity: 2,
          unitPrice: 250,
          partial: 500,
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
        },
      ],
      fromPeriodKey: "2026-04",
      toPeriodKey: "2026-05",
    });

    expect(result.periods.map((period) => period.key)).toEqual(["2026-04", "2026-05"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      budgetItemId: "item-1",
      rowTotal: 800,
      periodAmounts: {
        "2026-04": 300,
        "2026-05": 500,
      },
    });
    expect(result.availableRange).toMatchObject({
      fromPeriodKey: "2026-03",
      toPeriodKey: "2026-05",
    });
    expect(result.selectedRange).toMatchObject({
      fromPeriodKey: "2026-04",
      toPeriodKey: "2026-05",
    });
    expect(result.isPartial).toBe(true);
  });
});

describe("buildWorkScheduleResourceCalendar", () => {
  it("derives monthly resource quantities and valued amounts from the scheduled partidas APU", () => {
    const result = buildWorkScheduleResourceCalendar({
      currency: "PEN",
      lines: [
        {
          scheduleItemId: "ws-1",
          budgetItemId: "item-1",
          itemCode: "01.01",
          description: "Concreto simple",
          unit: "M3",
          quantity: 10,
          unitPrice: 50,
          partial: 500,
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          monthlyDistributions: [
            { year: 2026, month: 3, percentage: 40 },
            { year: 2026, month: 4, percentage: 60 },
          ],
          resources: [
            {
              resourceId: "res-1",
              code: "MAT-001",
              description: "Cemento",
              unit: "BLS",
              unitPrice: 20,
              totalQuantity: 12,
              totalCost: 240,
            },
            {
              resourceId: "res-2",
              code: "LAB-001",
              description: "Operario",
              unit: "HH",
              unitPrice: 10,
              totalQuantity: 8,
              totalCost: 80,
            },
          ],
        },
      ],
    });

    expect(result.periods.map((period) => period.key)).toEqual(["2026-03", "2026-04"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      resourceId: "res-1",
      quantity: 12,
      partial: 240,
      periodQuantities: {
        "2026-03": 4.8,
        "2026-04": 7.2,
      },
      periodAmounts: {
        "2026-03": 96,
        "2026-04": 144,
      },
    });
  });
});

describe("buildWorkScheduleCurveSeries", () => {
  it("builds monthly and accumulated S-curve values that close against the programmed total", () => {
    const result = buildWorkScheduleCurveSeries({
      periods: [
        { year: 2026, month: 3, key: "2026-03" },
        { year: 2026, month: 4, key: "2026-04" },
        { year: 2026, month: 5, key: "2026-05" },
      ],
      monthlyTotals: {
        "2026-03": 100,
        "2026-04": 250,
        "2026-05": 150,
      },
    });

    expect(result).toEqual([
      { year: 2026, month: 3, key: "2026-03", monthlyAmount: 100, accumulatedAmount: 100, accumulatedPercentage: 20 },
      { year: 2026, month: 4, key: "2026-04", monthlyAmount: 250, accumulatedAmount: 350, accumulatedPercentage: 70 },
      { year: 2026, month: 5, key: "2026-05", monthlyAmount: 150, accumulatedAmount: 500, accumulatedPercentage: 100 },
    ]);
  });
});

describe("buildWorkScheduleView", () => {
  it("summarizes schedule scale so oversized timelines and calendars can be deferred", () => {
    const result = analyzeWorkScheduleScale([
      {
        budgetItemId: "item-1",
        itemCode: "01.01",
        description: "Actividad extrema",
        unit: "UND",
        quantity: 1,
        unitPrice: 1,
        partial: 1,
        subBudgetId: "sub-1",
        subBudgetName: "General",
        startDate: "2026-01-01",
        endDate: "2041-01-01",
        durationDays: 5479,
        monthlyDistributions: [
          { year: 2026, month: 1, percentage: 50 },
          { year: 2041, month: 1, percentage: 50 },
        ],
      },
    ]);

    expect(result).toMatchObject({
      periodCount: 2,
      timelineDayCount: 5480,
      canLoadDailyTimeline: false,
      canLoadDerivedCalendars: true,
    });
  });

  it("can skip derived calendars for the initial overview payload", () => {
    const result = buildWorkScheduleView(
      {
        budgetId: "budget-1",
        budgetName: "Presupuesto General",
        currency: "PEN",
        projectName: "Proyecto demo",
        lines: [
          {
            budgetItemId: "item-1",
            itemCode: "01.01",
            description: "Actividad 1",
            unit: "UND",
            quantity: 1,
            unitPrice: 100,
            partial: 100,
            subBudgetId: "sub-1",
            subBudgetName: "General",
            startDate: "2026-01-01",
            endDate: "2026-01-31",
            durationDays: 31,
            monthlyDistributions: [{ year: 2026, month: 1, percentage: 100 }],
          },
        ],
      },
      { includeDerivedCalendars: false },
    );

    expect(result.valuationCalendar).toBeNull();
    expect(result.resourceCalendar).toBeNull();
    expect(result.curveSeries).toBeNull();
    expect(result.scale).toMatchObject({
      periodCount: 1,
      timelineDayCount: 31,
      canLoadDailyTimeline: true,
      canLoadDerivedCalendars: true,
    });
  });

  it("attaches critical path metadata and summary to scheduled lines", () => {
    const result = buildWorkScheduleView({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      currency: "PEN",
      projectName: "Proyecto demo",
      lines: [
        {
          budgetItemId: "item-1",
          itemCode: "01",
          description: "Ruta principal",
          unit: "UND",
          quantity: 1,
          unitPrice: 1,
          partial: 1,
          subBudgetId: "sub-1",
          subBudgetName: "General",
          startDate: "2026-03-01",
          endDate: "2026-03-05",
          durationDays: 5,
          monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
        },
        {
          budgetItemId: "item-2",
          itemCode: "02",
          description: "Rama secundaria",
          unit: "UND",
          quantity: 1,
          unitPrice: 1,
          partial: 1,
          subBudgetId: "sub-1",
          subBudgetName: "General",
          startDate: "2026-03-01",
          endDate: "2026-03-02",
          durationDays: 2,
          monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
        },
        {
          budgetItemId: "item-3",
          itemCode: "03",
          description: "Cierre",
          unit: "UND",
          quantity: 1,
          unitPrice: 1,
          partial: 1,
          subBudgetId: "sub-1",
          subBudgetName: "General",
          startDate: "2026-03-06",
          endDate: "2026-03-06",
          durationDays: 1,
          predecessor: "01FS,02FS",
          monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
        },
      ],
    });

    const lines = result.groups.flatMap((group) => group.lines);

    expect(result.criticalPath).toMatchObject({
      status: "calculated",
      criticalItemCount: 2,
      projectDurationDays: 6,
      issues: [],
    });
    expect(lines.find((line) => line.budgetItemId === "item-1")?.criticalPath).toMatchObject({ isCritical: true, totalSlackDays: 0 });
    expect(lines.find((line) => line.budgetItemId === "item-2")?.criticalPath).toMatchObject({ isCritical: false, totalSlackDays: 3 });
    expect(lines.find((line) => line.budgetItemId === "item-3")?.criticalPath).toMatchObject({ isCritical: true, totalSlackDays: 0 });
  });

  it("groups lines by sub budget and exposes timeline bounds for the gantt view", () => {
    const result = buildWorkScheduleView({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      currency: "PEN",
      projectName: "Proyecto demo",
      lines: [
        {
          scheduleItemId: "ws-1",
          budgetItemId: "item-1",
          itemCode: "01.01",
          description: "Trazo y replanteo",
          unit: "GLB",
          quantity: 1,
          unitPrice: 1000,
          partial: 1000,
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          startDate: "2026-03-01",
          endDate: "2026-03-07",
          durationDays: 7,
          monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
        },
        {
          scheduleItemId: "ws-2",
          budgetItemId: "item-2",
          itemCode: "02.01",
          description: "Tarrajeo",
          unit: "M2",
          quantity: 10,
          unitPrice: 20,
          partial: 200,
          subBudgetId: "sub-2",
          subBudgetName: "Arquitectura",
          startDate: "2026-03-08",
          endDate: "2026-03-21",
          durationDays: 14,
          monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
        },
      ],
    });

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]).toMatchObject({
      subBudgetName: "Estructuras",
      totalAmount: 1000,
    });
    expect(result.groups[1]).toMatchObject({
      subBudgetName: "Arquitectura",
      totalAmount: 200,
    });
    expect(result.valuationCalendar.rows.map((row) => row.budgetItemId)).toEqual(["item-1", "item-2"]);
    expect(result.timeline).toMatchObject({
      startDate: "2026-03-01",
      endDate: "2026-03-21",
    });
  });

  it("extends the gantt timeline to the farthest scheduled or distributed date", () => {
    const result = buildWorkScheduleView({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      currency: "PEN",
      projectName: "Proyecto demo",
      lines: [
        {
          scheduleItemId: "ws-1",
          budgetItemId: "item-1",
          itemCode: "01.01",
          description: "Escaleras",
          unit: "UND",
          quantity: 1,
          unitPrice: 1000,
          partial: 1000,
          subBudgetId: "sub-1",
          subBudgetName: "Arquitectura",
          startDate: "2027-01-10",
          endDate: "2027-01-16",
          durationDays: 7,
          monthlyDistributions: [
            { year: 2027, month: 1, percentage: 50 },
            { year: 2027, month: 2, percentage: 50 },
          ],
        },
      ],
    });

    expect(result.timeline).toMatchObject({
      startDate: "2027-01-10",
      endDate: "2027-01-16",
    });
  });

  it("falls back to monthly distributions when scheduled dates are missing", () => {
    const result = buildWorkScheduleView({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      currency: "PEN",
      projectName: "Proyecto demo",
      lines: [
        {
          scheduleItemId: "ws-1",
          budgetItemId: "item-1",
          itemCode: "01.01",
          description: "Escaleras",
          unit: "UND",
          quantity: 1,
          unitPrice: 1000,
          partial: 1000,
          subBudgetId: "sub-1",
          subBudgetName: "Arquitectura",
          monthlyDistributions: [
            { year: 2027, month: 1, percentage: 50 },
            { year: 2027, month: 2, percentage: 50 },
          ],
        },
      ],
    });

    expect(result.timeline).toMatchObject({
      startDate: "2027-01-01",
      endDate: "2027-02-28",
    });
  });

  it("uses the farthest per-line fallback date for the timeline end", () => {
    const result = buildWorkScheduleView({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      currency: "PEN",
      projectName: "Proyecto demo",
      lines: [
        {
          scheduleItemId: "ws-1",
          budgetItemId: "item-1",
          itemCode: "01.01",
          description: "Trazo y replanteo",
          unit: "GLB",
          quantity: 1,
          unitPrice: 1000,
          partial: 1000,
          subBudgetId: "sub-1",
          subBudgetName: "Arquitectura",
          startDate: "2027-01-10",
          endDate: "2027-01-16",
          durationDays: 7,
          monthlyDistributions: [{ year: 2027, month: 1, percentage: 100 }],
        },
        {
          scheduleItemId: "ws-2",
          budgetItemId: "item-2",
          itemCode: "01.02",
          description: "Escaleras",
          unit: "UND",
          quantity: 1,
          unitPrice: 1000,
          partial: 1000,
          subBudgetId: "sub-1",
          subBudgetName: "Arquitectura",
          startDate: "2027-01-20",
          monthlyDistributions: [
            { year: 2027, month: 1, percentage: 50 },
            { year: 2027, month: 2, percentage: 50 },
          ],
        },
      ],
    });

    expect(result.timeline).toMatchObject({
      startDate: "2027-01-10",
      endDate: "2027-02-28",
    });
  });
});
