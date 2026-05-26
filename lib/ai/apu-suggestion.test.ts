import { describe, expect, it } from "vitest";
import { buildApuRowsFromAiSuggestion, parseAiDecimal, parseAiPerformance } from "@/lib/ai/apu-suggestion";
import type { AiApuStructuredData } from "@/lib/ai/types";

describe("AI APU suggestion helpers", () => {
  it("parses decimal-like AI quantities from construction text", () => {
    expect(parseAiDecimal("2")).toBe(2);
    expect(parseAiDecimal("2.5")).toBe(2.5);
    expect(parseAiDecimal("2,5")).toBe(2.5);
    expect(parseAiDecimal("12 m3/dia")).toBe(12);
    expect(parseAiDecimal("sin dato")).toBeNull();
  });

  it("parses performance and falls back to the current value when unavailable", () => {
    expect(parseAiPerformance("12 m3/dia", 8)).toBe(12);
    expect(parseAiPerformance("sin dato", 8)).toBe(8);
  });

  it("maps structured materials, labor and equipment into draft APU rows with zero prices", () => {
    const suggestion: AiApuStructuredData = {
      answer: "Propuesta base",
      unit: "m2",
      performance: "12 m2/dia",
      crew: "1 operario + 1 peon",
      materials: [{ description: "Cemento", unit: "bol", quantity: "0,25" }],
      labor: [{ description: "Operario", unit: "hh", quantity: "1.5" }],
      equipment: [{ description: "Mezcladora", unit: "hm", quantity: "0.2" }],
      observations: [],
      assumptions: [],
    };

    const rows = buildApuRowsFromAiSuggestion({
      suggestion,
      catalogPartidaId: "partida-1",
      existingRowsCount: 2,
      createId: (index) => `ai-row-${index}`,
    });

    expect(rows).toEqual([
      expect.objectContaining({ id: "ai-row-0", description: "Cemento", unit: "bol", quantity: 0.25, unitPrice: 0, resourceType: "MATERIAL", sortOrder: 2 }),
      expect.objectContaining({ id: "ai-row-1", description: "Operario", unit: "hh", quantity: 1.5, unitPrice: 0, resourceType: "LABOR", sortOrder: 3 }),
      expect.objectContaining({ id: "ai-row-2", description: "Mezcladora", unit: "hm", quantity: 0.2, unitPrice: 0, resourceType: "EQUIPMENT", sortOrder: 4 }),
    ]);
  });

  it("keeps incomplete structured resources visible as partial rows", () => {
    const suggestion: AiApuStructuredData = {
      answer: "Propuesta parcial",
      unit: "m",
      performance: "",
      crew: "",
      materials: [{ description: "", unit: "", quantity: "" }],
      labor: [],
      equipment: [],
      observations: [],
      assumptions: [],
    };

    const rows = buildApuRowsFromAiSuggestion({
      suggestion,
      catalogPartidaId: "partida-1",
      existingRowsCount: 0,
      createId: () => "ai-row-partial",
    });

    expect(rows).toEqual([
      expect.objectContaining({
        id: "ai-row-partial",
        description: "Recurso sugerido sin descripcion",
        unit: "",
        quantity: 0,
        unitPrice: 0,
        resourceType: "MATERIAL",
      }),
    ]);
  });
});
