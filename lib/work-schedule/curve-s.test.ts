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

describe("buildPlannedVsActualCurveSeries - integration", () => {
  it("acumula avance planificado vs real en una secuencia realista de 3 partidas y es idempotente", () => {
    // Cadena constructiva tipica con presupuesto realista (S/ 4000 total):
    //   Excavacion (S/ 1000) - 100% completado   - 50% Ene + 50% Feb
    //   Cimentacion (S/ 2000) - 50%  completado   - 100% Feb (concentrado)
    //   Estructura (S/ 1000)  - 0%  completado   - 100% Mar (a futuro)
    const excav = createLine({
      budgetItemId: "cline_excav_001",
      itemCode: "01.01",
      description: "Excavacion manual de zanjas",
      partial: 1000,
      startDate: "2024-01-01",
      endDate: "2024-02-29",
      percentComplete: 100,
      monthlyDistributions: [
        { year: 2024, month: 1, percentage: 50 },
        { year: 2024, month: 2, percentage: 50 },
      ],
    });
    const cim = createLine({
      budgetItemId: "cline_cim_002",
      itemCode: "01.02",
      description: "Cimentacion corrida de concreto",
      partial: 2000,
      startDate: "2024-02-01",
      endDate: "2024-02-29",
      percentComplete: 50,
      monthlyDistributions: [
        { year: 2024, month: 2, percentage: 100 },
      ],
    });
    const est = createLine({
      budgetItemId: "cline_est_003",
      itemCode: "01.03",
      description: "Estructura de concreto armado",
      partial: 1000,
      startDate: "2024-03-01",
      endDate: "2024-03-31",
      percentComplete: 0,
      monthlyDistributions: [
        { year: 2024, month: 3, percentage: 100 },
      ],
    });

    const lines = [excav, cim, est];
    const periods = [
      { year: 2024, month: 1 },
      { year: 2024, month: 2 },
      { year: 2024, month: 3 },
    ];

    const result = buildPlannedVsActualCurveSeries({ lines, periods });

    // 1. Idempotencia cross-call.
    const secondResult = buildPlannedVsActualCurveSeries({ lines, periods });
    expect(secondResult).toEqual(result);

    // 2. Envelope: 3 puntos de curva (1 por periodo).
    expect(result).toHaveLength(3);

    // 3. Periodo Enero 2024:
    //    planned Ene = 1000 * 50% = 500; plannedAccum = 500; pct = 500/4000*100 = 12.5
    //    actual  Ene = 500 * 100% = 500; actualAccum = 500; pct = 12.5
    expect(result[0]).toEqual({ period: "2024-01", plannedPercent: 12.5, actualPercent: 12.5 });

    // 4. Periodo Febrero 2024 (cumulative):
    //    planned Feb = 500 (excav Feb) + 2000 (cim Feb) = 2500; plannedAccum = 750 -> 3000; pct = 75
    //    actual  Feb = 500*100% + 2000*50% = 500 + 1000 = 1500; actualAccum = 500 + 1500 = 2000; pct = 50
    expect(result[1]).toEqual({ period: "2024-02", plannedPercent: 75, actualPercent: 50 });

    // 5. Periodo Marzo 2024 (cumulative):
    //    planned Mar = 1000 (est Mar); plannedAccum = 3000 + 1000 = 4000; pct = 100
    //    actual  Mar = 1000 * 0% = 0; actualAccum = 2000 (sin cambio); pct = 50
    expect(result[2]).toEqual({ period: "2024-03", plannedPercent: 100, actualPercent: 50 });

    // 6. Cross-invariant: planificado llega a 100% al final del proyecto
    // (cuando las distribuciones cubren todos los periodos provistos).
    const lastPoint = result[result.length - 1];
    if (!lastPoint) {
      throw new Error("expected at least one curve point");
    }
    expect(lastPoint.plannedPercent).toBe(100);

    // 7. Cross-invariant: actualPercent <= plannedPercent por periodo
    // (no hemos sobre-ejecutado; este escenario es lineal).
    for (const point of result) {
      expect(point.actualPercent).toBeLessThanOrEqual(point.plannedPercent);
    }

    // 8. Cross-invariant: actualPercent es monotono no-decreciente (avance acumulado).
    for (let i = 1; i < result.length; i++) {
      const current = result[i];
      const previous = result[i - 1];
      if (!current || !previous) {
        throw new Error("index consistency issue in curve points");
      }
      expect(current.actualPercent).toBeGreaterThanOrEqual(previous.actualPercent);
    }

    // 9. Cross-invariant: plannedPercent monotono no-decreciente.
    for (let i = 1; i < result.length; i++) {
      const current = result[i];
      const previous = result[i - 1];
      if (!current || !previous) {
        throw new Error("index consistency issue in curve points");
      }
      expect(current.plannedPercent).toBeGreaterThanOrEqual(previous.plannedPercent);
    }

    // 10. Sanity total: suma de parciales del input === budget total esperado.
    const totalPartial = lines.reduce((acc, l) => acc + (l.partial ?? 0), 0);
    expect(totalPartial).toBe(4000);
  });
});
