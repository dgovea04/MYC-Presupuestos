import { describe, expect, it } from "vitest";
import { buildIntelligentWorkScheduleBase } from "@/lib/work-schedule/intelligent-schedule";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";

function createLine(overrides: Partial<WorkScheduleLineRecord>): WorkScheduleLineRecord {
  return {
    budgetItemId: "item-1",
    itemCode: "01.01",
    description: "Trazo y replanteo",
    unit: "M2",
    quantity: 100,
    unitPrice: 10,
    partial: 1000,
    subBudgetId: "sub-1",
    subBudgetName: "Estructuras",
    startDate: null,
    endDate: null,
    durationDays: null,
    predecessor: null,
    crew: 2,
    performance: 10,
    performanceLabel: "10 M2/DIA",
    monthlyDistributions: [],
    ...overrides,
  };
}

describe("buildIntelligentWorkScheduleBase", () => {
  it("builds a sequential gantt base inside each sub budget using quantity, performance and default cronograma crew", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          quantity: 100,
          performance: 10,
          crew: 2,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "01.02",
          quantity: 60,
          performance: 10,
          crew: 2,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([
      expect.objectContaining({
        budgetItemId: "item-1",
        itemCode: "01.01",
        startDate: "2026-06-01",
        endDate: "2026-06-10",
        durationDays: 10,
        crew: 1,
        predecessor: null,
      }),
      expect.objectContaining({
        budgetItemId: "item-2",
        itemCode: "01.02",
        startDate: "2026-06-11",
        endDate: "2026-06-16",
        durationDays: 6,
        crew: 1,
        predecessor: "01.01FS",
      }),
    ]);
  });

  it("starts each sub budget sequence from the same base date", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          quantity: 20,
          performance: 10,
          crew: 1,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          subBudgetId: "sub-2",
          subBudgetName: "Arquitectura",
          quantity: 30,
          performance: 10,
          crew: 1,
        }),
      ],
    });

    expect(result.generatedItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ budgetItemId: "item-2", startDate: "2026-06-01", durationDays: 3 }),
      expect.objectContaining({ budgetItemId: "item-1", startDate: "2026-06-01", durationDays: 2 }),
    ]));
  });

  it("marks lines without enough data as pending instead of forcing a duration", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          performance: null,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([]);
    expect(result.summary).toEqual({
      generatedCount: 0,
      pendingCount: 1,
      issues: [
        {
          budgetItemId: "item-1",
          itemCode: "01.01",
          reason: "La partida no tiene rendimiento o cuadrilla suficiente para calcular duracion",
        },
      ],
    });
  });

  it("resets persisted cronograma crew values to 1 when regenerating the intelligent base", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          quantity: 100,
          performance: 10,
          crew: 5,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([
      expect.objectContaining({
        budgetItemId: "item-1",
        durationDays: 10,
        crew: 1,
      }),
    ]);
  });

  it("skips lines whose calculated duration is absurdly large", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "UND",
          quantity: 400000,
          performance: 0.5,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([]);
    expect(result.summary).toEqual({
      generatedCount: 0,
      pendingCount: 1,
      issues: [
        {
          budgetItemId: "item-1",
          itemCode: "01.01",
          reason: "La duracion calculada supera el limite permitido de 36,525 dias",
        },
      ],
    });
  });

  it("marks metric-style partidas with the default technical performance as pending", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "m2",
          quantity: 250,
          performance: 1,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([]);
    expect(result.summary).toEqual({
      generatedCount: 0,
      pendingCount: 1,
      issues: [
        {
          budgetItemId: "item-1",
          itemCode: "01.01",
          reason: "La partida mantiene el rendimiento tecnico por defecto (1 m2/DIA) para su metrado actual. Define un rendimiento real antes de programarla",
        },
      ],
    });
  });

  it("marks large non-metric partidas with default technical performance as pending too", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "pto",
          quantity: 900,
          performance: 1,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([]);
    expect(result.summary).toEqual({
      generatedCount: 0,
      pendingCount: 1,
      issues: [
        {
          budgetItemId: "item-1",
          itemCode: "01.01",
          reason: "La partida mantiene el rendimiento tecnico por defecto (1 pto/DIA) para su metrado actual. Define un rendimiento real antes de programarla",
        },
      ],
    });
  });
});
