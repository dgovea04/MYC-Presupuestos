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

  it("registra diagnostico de predecesora inexistente y mantiene critical-path valido para partidas subsiguientes", () => {
    // Cadena donde B tiene una predecesora que NO existe en el cronograma
    // ("99.99FS" apunta al codigo "99.99" ausente). El algoritmo debe:
    //   1. Anadir entry a `issues` sin lanzar excepcion.
    //   2. Mantener A -> C -> D como critical path valido (slack = 0).
    //   3. Reportar a B con slack > 0 (no critical) porque la dep se omite
    //      y el path valido no la atraviesa.
    const input: WorkScheduleLineRecord[] = [
      createRealisticPartida({
        budgetItemId: "cline_excav_001",
        itemCode: "01.01",
        description: "Excavacion manual de zanjas",
        unit: "m3",
        quantity: 250.5,
        durationDays: 8,
        predecessor: null,
      }),
      createRealisticPartida({
        budgetItemId: "cline_imprevistos_002",
        itemCode: "01.02",
        description: "Partida con predecesora inexistente (debe registrar issue sin romper)",
        unit: "gl",
        quantity: 1,
        durationDays: 12,
        predecessor: "99.99FS",
      }),
      createRealisticPartida({
        budgetItemId: "cline_cim_003",
        itemCode: "01.03",
        description: "Cimentacion corrida de concreto",
        unit: "m3",
        quantity: 45.2,
        durationDays: 10,
        predecessor: "01.01FS",
      }),
      createRealisticPartida({
        budgetItemId: "cline_est_004",
        itemCode: "01.04",
        description: "Estructura de concreto armado",
        unit: "m3",
        quantity: 120.0,
        durationDays: 5,
        predecessor: "01.03FS",
      }),
    ];

    const result = calculateWorkScheduleCriticalPath(input);

    // 1. Status: NO es ciclo (la dep inexistente no crea ciclo, solo se
    //    omite el edge). El algoritmo retorna "calculated".
    expect(result.status).toBe("calculated");

    // 2. Diagnostics: issues contiene el mensaje exacto del algoritmo.
    expect(result.issues).toContain(
      "La predecesora 99.99 no existe en este cronograma",
    );

    // 3. Items: las 4 partidas sobreviven (todas tienen durationDays > 0
    //    explicito). La dep inexistente NO las filtra.
    expect(result.itemsByBudgetItemId.size).toBe(4);

    // 4. Duracion total = A (8) + C (10) + D (5) = 23 dias en el critical path.
    //    B queda fuera con slack > 0 (sin predecessor efectivo).
    expect(result.projectDurationDays).toBe(23);

    // 5. A: arranca el proyecto, termina en dia 7, sin slack.
    expect(result.itemsByBudgetItemId.get("cline_excav_001")).toEqual({
      budgetItemId: "cline_excav_001",
      itemCode: "01.01",
      durationDays: 8,
      earlyStartDay: 0,
      earlyFinishDay: 7,
      lateStartDay: 0,
      lateFinishDay: 7,
      totalSlackDays: 0,
      isCritical: true,
    });

    // 6. B: sin predecessor efectivo porque la dep 99.99FS fue omitida.
    //    Arranca en 0 pero queda FUERA del critical path porque A -> C -> D
    //    cierra en dia 22 y B puede correr en paralelo. Slack = 11.
    expect(result.itemsByBudgetItemId.get("cline_imprevistos_002")).toEqual({
      budgetItemId: "cline_imprevistos_002",
      itemCode: "01.02",
      durationDays: 12,
      earlyStartDay: 0,
      earlyFinishDay: 11,
      lateStartDay: 11,
      lateFinishDay: 22,
      totalSlackDays: 11,
      isCritical: false,
    });

    // 7. C: arranca tras A (FS, lag=0) = dia 8.
    expect(result.itemsByBudgetItemId.get("cline_cim_003")).toEqual({
      budgetItemId: "cline_cim_003",
      itemCode: "01.03",
      durationDays: 10,
      earlyStartDay: 8,
      earlyFinishDay: 17,
      lateStartDay: 8,
      lateFinishDay: 17,
      totalSlackDays: 0,
      isCritical: true,
    });

    // 8. D: cierra el proyecto. lateFinishDay = projectFinishDay = 22.
    expect(result.itemsByBudgetItemId.get("cline_est_004")).toEqual({
      budgetItemId: "cline_est_004",
      itemCode: "01.04",
      durationDays: 5,
      earlyStartDay: 18,
      earlyFinishDay: 22,
      lateStartDay: 18,
      lateFinishDay: 22,
      totalSlackDays: 0,
      isCritical: true,
    });

    // 9. Idempotencia cross-call.
    const secondResult = calculateWorkScheduleCriticalPath(input);
    expect(secondResult).toEqual(result);

    // 10. Cross-partida: la ultima del critical path cierra projectDurationDays.
    const lastCritical = result.itemsByBudgetItemId.get("cline_est_004");
    if (!lastCritical) {
      throw new Error("expected cline_est_004 to be present in result");
    }
    expect(lastCritical.lateFinishDay + 1).toBe(result.projectDurationDays);

    // 11. Asimetria clave del test: la suma de TODAS las duraciones del input
    //     es 8 + 12 + 10 + 5 = 35, pero projectDurationDays es solo 23 porque
    //     B queda fuera del critical path con slack = 11. Esta asimetria es la
    //     firma del comportamiento correcto ante dep inexistente.
    const totalDurationOfChain = input
      .filter((l) => l.durationDays != null && l.durationDays > 0)
      .reduce((acc, l) => acc + (l.durationDays ?? 0), 0);
    expect(totalDurationOfChain).toBe(35);
    expect(result.projectDurationDays).toBeLessThan(totalDurationOfChain);

    // 12. El slack total = 11 (B con slack=11, A/C/D con slack=0). NOTA: la
    //     diferencia algebraica 35 - 23 = 12 NO coincide con totalSlack (11)
    //     porque el "slack" mide dias de RETRASO posibles antes de romper el
    //     critical path (lateStart - earlyStart), no la duracion absoluta de
    //     la partida. B puede retrasarse 11 dias para arrancar en dia 11
    //     aunque su duracion es 12.
    const totalSlack = Array.from(result.itemsByBudgetItemId.values()).reduce(
      (acc, item) => acc + item.totalSlackDays,
      0,
    );
    expect(totalSlack).toBe(11);

    // 13. Solo A, C, D son criticas; B no.
    const criticalIds = Array.from(result.itemsByBudgetItemId.values())
      .filter((item) => item.isCritical)
      .map((item) => item.budgetItemId)
      .sort();
    expect(criticalIds).toEqual([
      "cline_cim_003",
      "cline_est_004",
      "cline_excav_001",
    ]);
  });
});

