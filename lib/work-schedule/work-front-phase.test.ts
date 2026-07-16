import { describe, expect, it } from "vitest";
import { classifyWorkFrontPhase, sortWorkFrontLines, WORK_FRONT_PHASE_KEYWORDS, WORK_FRONT_PHASE_ORDER } from "@/lib/work-schedule/work-front-phase";
import type { WorkFrontLine } from "@/lib/work-schedule/work-front-phase";
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

describe("classifyWorkFrontPhase", () => {
  it("classifies preliminaries keywords", () => {
    expect(classifyWorkFrontPhase(createLine({ description: "Limpieza de terreno" }))).toBe("preliminaries");
    expect(classifyWorkFrontPhase(createLine({ description: "Trazo y replanteo" }))).toBe("preliminaries");
    expect(classifyWorkFrontPhase(createLine({ description: "Cartel de obra" }))).toBe("preliminaries");
    expect(classifyWorkFrontPhase(createLine({ description: "Movilizacion del campamento" }))).toBe("preliminaries");
    expect(classifyWorkFrontPhase(createLine({ description: "Demolicion preliminar" }))).toBe("preliminaries");
  });

  it("classifies earthwork keywords", () => {
    expect(classifyWorkFrontPhase(createLine({ description: "Excavacion de zapatas" }))).toBe("earthwork");
    expect(classifyWorkFrontPhase(createLine({ description: "Corte y relleno" }))).toBe("earthwork");
    expect(classifyWorkFrontPhase(createLine({ description: "Compactacion de terreno" }))).toBe("earthwork");
    expect(classifyWorkFrontPhase(createLine({ description: "Desbroce y desmonte" }))).toBe("earthwork");
  });

  it("classifies structure keywords", () => {
    expect(classifyWorkFrontPhase(createLine({ description: "Concreto f'c=210 kg/cm2" }))).toBe("structure");
    expect(classifyWorkFrontPhase(createLine({ description: "Acero de refuerzo" }))).toBe("structure");
    expect(classifyWorkFrontPhase(createLine({ description: "Columna de concreto" }))).toBe("structure");
    expect(classifyWorkFrontPhase(createLine({ description: "Placa de concreto" }))).toBe("structure");
  });

  it("classifies masonry keywords", () => {
    expect(classifyWorkFrontPhase(createLine({ description: "Muro de ladrillo" }))).toBe("masonry");
    expect(classifyWorkFrontPhase(createLine({ description: "Tabique de albanileria" }))).toBe("masonry");
    expect(classifyWorkFrontPhase(createLine({ description: "Muro de bloque" }))).toBe("masonry");
  });

  it("classifies installations keywords", () => {
    expect(classifyWorkFrontPhase(createLine({ description: "Instalacion electrica" }))).toBe("installations");
    expect(classifyWorkFrontPhase(createLine({ description: "Tuberia sanitaria" }))).toBe("installations");
    expect(classifyWorkFrontPhase(createLine({ description: "Sistema de climatizacion" }))).toBe("installations");
    expect(classifyWorkFrontPhase(createLine({ description: "Red de datos" }))).toBe("installations");
  });

  it("classifies finishes keywords", () => {
    expect(classifyWorkFrontPhase(createLine({ description: "Pintura latex" }))).toBe("finishes");
    expect(classifyWorkFrontPhase(createLine({ description: "Enchape ceramico" }))).toBe("finishes");
    expect(classifyWorkFrontPhase(createLine({ description: "Drywall y tablayeso" }))).toBe("finishes");
    expect(classifyWorkFrontPhase(createLine({ description: "Vidrio y techos" }))).toBe("finishes");
  });

  it("classifies testing keywords", () => {
    expect(classifyWorkFrontPhase(createLine({ description: "Prueba hidraulica" }))).toBe("testing");
    expect(classifyWorkFrontPhase(createLine({ description: "Limpieza final" }))).toBe("testing");
    expect(classifyWorkFrontPhase(createLine({ description: "Entrega y recepcion" }))).toBe("testing");
    expect(classifyWorkFrontPhase(createLine({ description: "Inspeccion de calidad" }))).toBe("testing");
  });

  it("treats testing as higher priority than preliminaries for 'limpieza final'", () => {
    expect(classifyWorkFrontPhase(createLine({ description: "Limpieza final del terreno" }))).toBe("testing");
  });

  it("falls back to other for unrecognized descriptions", () => {
    expect(classifyWorkFrontPhase(createLine({ description: "Servicio especial alfa" }))).toBe("other");
    expect(classifyWorkFrontPhase(createLine({ description: "Partida generica" }))).toBe("other");
  });

  it("ignores accents and case when matching keywords", () => {
    expect(classifyWorkFrontPhase(createLine({ description: "Excavación Masiva" }))).toBe("earthwork");
    expect(classifyWorkFrontPhase(createLine({ description: "PINTURA LATEX" }))).toBe("finishes");
  });

  it.each([
    { description: "Excavacion y concreto", expected: "earthwork", reason: "earthwork is checked before structure" },
    { description: "Concreto y pintura", expected: "structure", reason: "structure is checked before finishes" },
    { description: "Limpieza y entrega", expected: "testing", reason: "testing is checked before preliminaries" },
    { description: "Muro de concreto", expected: "structure", reason: "structure is checked before masonry" },
    { description: "Excavacion y limpieza", expected: "preliminaries", reason: "preliminaries is checked before earthwork" },
    { description: "Pintura y cable", expected: "installations", reason: "installations is checked before finishes" },
    { description: "Concreto y excavacion", expected: "earthwork", reason: "word order does not affect precedence" },
  ])("classifies '$description' as $expected because $reason", ({ description, expected }) => {
    expect(classifyWorkFrontPhase(createLine({ description }))).toBe(expected);
  });

  it("includes item code and unit in the searchable text", () => {
    expect(classifyWorkFrontPhase(createLine({ itemCode: "01.01", description: "Partida generica", unit: "m3" }))).toBe("other");
    expect(classifyWorkFrontPhase(createLine({ itemCode: "01.01", description: "Partida generica", unit: "m2" }))).toBe("other");
    // itemCode containing a keyword can shift classification
    expect(classifyWorkFrontPhase(createLine({ itemCode: "prueba", description: "Partida generica", unit: "m2" }))).toBe("testing");
    // unit containing a keyword can shift classification
    expect(classifyWorkFrontPhase(createLine({ itemCode: "01.01", description: "Partida generica", unit: "concreto" }))).toBe("structure");
  });

  it("uses default keywords when no custom keywords are provided", () => {
    expect(classifyWorkFrontPhase(createLine({ description: "Concreto f'c=210" }))).toBe("structure");
    expect(classifyWorkFrontPhase(createLine({ description: "Concreto f'c=210" }), undefined)).toBe("structure");
    expect(classifyWorkFrontPhase(createLine({ description: "Concreto f'c=210" }), null)).toBe("structure");
    expect(classifyWorkFrontPhase(createLine({ description: "Concreto f'c=210" }), {})).toBe("structure");
  });

  it("replaces default keywords with custom keywords for a phase", () => {
    const customKeywords = {
      structure: ["hormigon"],
    };

    expect(classifyWorkFrontPhase(createLine({ description: "Hormigon armado" }), customKeywords)).toBe("structure");
    expect(classifyWorkFrontPhase(createLine({ description: "Concreto f'c=210" }), customKeywords)).toBe("other");
  });

  it("normalizes custom keywords before matching", () => {
    const customKeywords = {
      finishes: ["pintura latex", "ceramico"],
    };

    expect(classifyWorkFrontPhase(createLine({ description: "Pintura Latex" }), customKeywords)).toBe("finishes");
    expect(classifyWorkFrontPhase(createLine({ description: "Cerámico" }), customKeywords)).toBe("finishes");
  });

  it("preserves precedence order when using custom keywords", () => {
    const customKeywords = {
      testing: ["entrega final"],
      finishes: ["pintura"],
    };

    expect(classifyWorkFrontPhase(createLine({ description: "Entrega final" }), customKeywords)).toBe("testing");
    expect(classifyWorkFrontPhase(createLine({ description: "Pintura latex" }), customKeywords)).toBe("finishes");
  });
});

describe("WORK_FRONT_PHASE_ORDER", () => {
  it("orders phases by natural construction sequence", () => {
    expect(WORK_FRONT_PHASE_ORDER.preliminaries).toBeLessThan(WORK_FRONT_PHASE_ORDER.earthwork);
    expect(WORK_FRONT_PHASE_ORDER.earthwork).toBeLessThan(WORK_FRONT_PHASE_ORDER.structure);
    expect(WORK_FRONT_PHASE_ORDER.structure).toBeLessThan(WORK_FRONT_PHASE_ORDER.masonry);
    expect(WORK_FRONT_PHASE_ORDER.masonry).toBeLessThan(WORK_FRONT_PHASE_ORDER.installations);
    expect(WORK_FRONT_PHASE_ORDER.installations).toBeLessThan(WORK_FRONT_PHASE_ORDER.finishes);
    expect(WORK_FRONT_PHASE_ORDER.finishes).toBeLessThan(WORK_FRONT_PHASE_ORDER.testing);
  });
});

describe("WORK_FRONT_PHASE_KEYWORDS", () => {
  it("has non-empty keyword lists for all phases except other", () => {
    for (const [phase, keywords] of Object.entries(WORK_FRONT_PHASE_KEYWORDS)) {
      if (phase === "other") {
        expect(keywords).toHaveLength(0);
      } else {
        expect(keywords.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("sortWorkFrontLines", () => {
  it("orders lines by construction phase", () => {
    const lines: WorkFrontLine[] = [
      { line: createLine({ itemCode: "60", description: "Pintura" }), phase: "finishes", originalIndex: 0 },
      { line: createLine({ itemCode: "10", description: "Trazo" }), phase: "preliminaries", originalIndex: 1 },
      { line: createLine({ itemCode: "20", description: "Excavacion" }), phase: "earthwork", originalIndex: 2 },
      { line: createLine({ itemCode: "30", description: "Concreto" }), phase: "structure", originalIndex: 3 },
    ];

    const sorted = sortWorkFrontLines(lines);
    expect(sorted.map((item) => item.line.itemCode)).toEqual(["10", "20", "30", "60"]);
  });

  it("falls back to original index when phases tie", () => {
    const lines: WorkFrontLine[] = [
      { line: createLine({ itemCode: "2", description: "Trazo B" }), phase: "preliminaries", originalIndex: 1 },
      { line: createLine({ itemCode: "1", description: "Trazo A" }), phase: "preliminaries", originalIndex: 0 },
    ];

    const sorted = sortWorkFrontLines(lines);
    expect(sorted.map((item) => item.line.itemCode)).toEqual(["1", "2"]);
  });
});
