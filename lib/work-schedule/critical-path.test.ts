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

describe("calculateWorkScheduleCriticalPath - integration", () => {
  // Helper de dominio: crea una partida realista de presupuesto de obra con
  // duracion, costo y metrado representativos (no simbolicos como los unit tests).
  function createRealisticPartida(
    overrides: Partial<WorkScheduleLineRecord> & Pick<WorkScheduleLineRecord, "budgetItemId" | "itemCode" | "durationDays" | "predecessor">,
  ): WorkScheduleLineRecord {
    return line({
      description: overrides.description ?? overrides.itemCode,
      unit: overrides.unit ?? "m3",
      quantity: overrides.quantity ?? 100,
      unitPrice: overrides.unitPrice ?? 50,
      partial: overrides.partial ?? 5000,
      ...overrides,
    });
  }

  it("propaga dependencias FS a lo largo de una cadena constructiva realista de 3 partidas y es idempotente", () => {
    // Cadena secuencial tipica de obra: Excavacion -> Cimentacion -> Estructura.
    // Las duraciones son semanas-realistas (no simbolicas) y los codigos siguen
    // la convencion peruana (01.NN).
    const input: WorkScheduleLineRecord[] = [
      createRealisticPartida({
        budgetItemId: "cline_excavacion_001",
        itemCode: "01.01",
        description: "Excavacion manual de zanjas para cimentacion",
        unit: "m3",
        quantity: 250.5,
        durationDays: 8,
        predecessor: null,
      }),
      createRealisticPartida({
        budgetItemId: "cline_cimentacion_002",
        itemCode: "01.02",
        description: "Cimentacion corrida de concreto f'c=210 kg/cm2",
        unit: "m3",
        quantity: 45.2,
        durationDays: 12,
        predecessor: "01.01FS",
      }),
      createRealisticPartida({
        budgetItemId: "cline_estructura_003",
        itemCode: "01.03",
        description: "Estructura de concreto armado (columnas y vigas)",
        unit: "m3",
        quantity: 120.0,
        durationDays: 20,
        predecessor: "01.02FS",
      }),
    ];

    // Idempotencia: la misma entrada en dos invocaciones produce el mismo resultado.
    const firstResult = calculateWorkScheduleCriticalPath(input);
    const secondResult = calculateWorkScheduleCriticalPath(input);
    expect(secondResult).toEqual(firstResult);

    // Sanity a nivel de envelope del resultado.
    expect(firstResult.status).toBe("calculated");
    expect(firstResult.issues).toEqual([]);
    expect(firstResult.itemsByBudgetItemId.size).toBe(input.length);

    // Duracion total del proyecto = suma de la cadena = 8 + 12 + 20 = 40 dias.
    expect(firstResult.projectDurationDays).toBe(40);

    // Excavacion: arranca el proyecto, sin slack, fin en dia 7 (8 dias inclusive).
    expect(firstResult.itemsByBudgetItemId.get("cline_excavacion_001")).toEqual({
      budgetItemId: "cline_excavacion_001",
      itemCode: "01.01",
      durationDays: 8,
      earlyStartDay: 0,
      earlyFinishDay: 7,
      lateStartDay: 0,
      lateFinishDay: 7,
      totalSlackDays: 0,
      isCritical: true,
    });

    // Cimentacion: arranca 1 dia despues del fin de Excavacion (FS puro, lag=0).
    expect(firstResult.itemsByBudgetItemId.get("cline_cimentacion_002")).toEqual({
      budgetItemId: "cline_cimentacion_002",
      itemCode: "01.02",
      durationDays: 12,
      earlyStartDay: 8,
      earlyFinishDay: 19,
      lateStartDay: 8,
      lateFinishDay: 19,
      totalSlackDays: 0,
      isCritical: true,
    });

    // Estructura: cierra el critical path; fin en dia 39 (proyecto dura 40 dias).
    expect(firstResult.itemsByBudgetItemId.get("cline_estructura_003")).toEqual({
      budgetItemId: "cline_estructura_003",
      itemCode: "01.03",
      durationDays: 20,
      earlyStartDay: 20,
      earlyFinishDay: 39,
      lateStartDay: 20,
      lateFinishDay: 39,
      totalSlackDays: 0,
      isCritical: true,
    });

    // Invariante cross-partida: la ultima partida cierra el proyecto
    // (earlyFinishDay + 1 === projectDurationDays, dias son 0-indexados).
    const lastItem = firstResult.itemsByBudgetItemId.get("cline_estructura_003");
    if (!lastItem) {
      throw new Error("expected cline_estructura_003 to be present in result");
    }
    expect(lastItem.earlyFinishDay + 1).toBe(firstResult.projectDurationDays);

    // Invariante: en una cadena FS pura, todas las partidas son criticas
    // (ninguna tiene holgura) y su suma de durations == projectDurationDays.
    // Espeja el filter del algoritmo (descarta nulables y <=0) para que la
    // invariante se mantenga precisa ante cualquier shape de input.
    const totalDurationOfChain = input
      .filter((l) => l.durationDays != null && l.durationDays > 0)
      .reduce((acc, l) => acc + (l.durationDays ?? 0), 0);
    expect(totalDurationOfChain).toBe(firstResult.projectDurationDays);
    for (const item of firstResult.itemsByBudgetItemId.values()) {
      expect(item.totalSlackDays).toBe(0);
      expect(item.isCritical).toBe(true);
      expect(item.lateStartDay).toBe(item.earlyStartDay);
    }
  });
});

