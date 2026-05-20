import { describe, expect, it } from "vitest";
import {
  attachPartidaSuggestionsToGuidedPaste,
  createGuidedBudgetPaste,
} from "@/lib/budgets/paste-import";
import type { CatalogPartidaRecord } from "@/types/partida";

describe("attachPartidaSuggestionsToGuidedPaste", () => {
  const catalog: CatalogPartidaRecord[] = [
    createCatalogPartida("catalog-1", "Excavacion manual", "m3", 120),
    createCatalogPartida("catalog-2", "Relleno compactado", "m3", 95),
    createCatalogPartida("catalog-3", "Concreto simple", "m3", 280),
    createCatalogPartida("catalog-4", "Excavacion con maquinaria", "m3", 150),
    createCatalogPartida("catalog-5", "Excavacion de zanjas", "m3", 135),
  ];

  it("preserves parsing and enriches flat rows with exact, suggested, and unresolved states", () => {
    const guidedPaste = createGuidedBudgetPaste({
      rawText: [
        "IT-1\tExcavacion manual\tm3\t10",
        "IT-2\tExcavacion en zanja\tm3\t8",
        "IT-3\tObra\tm3\t2",
      ].join("\n"),
      startColumn: "code",
      targetKind: "item",
      applyMode: "insert-below",
    });

    const enriched = attachPartidaSuggestionsToGuidedPaste(guidedPaste, catalog);

    expect(enriched.rows).toEqual(guidedPaste.rows);
    expect(enriched.importedItems).toBe(3);
    expect(enriched.itemMatches).toHaveLength(3);
    expect(enriched.itemMatches[0]?.match.matchKind).toBe("exact");
    expect(enriched.itemMatches[1]?.match.matchKind).toBe("suggested");
    expect(enriched.itemMatches[2]?.match.matchKind).toBe("unresolved");
  });

  it("only enriches item entries when the paste is structured", () => {
    const guidedPaste = createGuidedBudgetPaste({
      rawText: "01\tOBRAS PRELIMINARES\n01.01\tExcavacion manual\tm3\t5",
      startColumn: "code",
      targetKind: "level",
      applyMode: "insert-inside-level",
    });

    const enriched = attachPartidaSuggestionsToGuidedPaste(guidedPaste, catalog);

    expect(enriched.entries).toEqual(guidedPaste.entries);
    expect(enriched.itemMatches).toHaveLength(1);
    expect(enriched.itemMatches[0]?.entryIndex).toBe(1);
    expect(enriched.itemMatches[0]?.match.matchKind).toBe("exact");
  });

  it("limits each item to at most three suggestions", () => {
    const guidedPaste = createGuidedBudgetPaste({
      rawText: "IT-1\tExcavacion\tm3\t4",
      startColumn: "code",
      targetKind: "item",
      applyMode: "insert-below",
    });

    const enriched = attachPartidaSuggestionsToGuidedPaste(guidedPaste, catalog);

    expect(enriched.itemMatches[0]?.match.suggestions).toHaveLength(3);
  });
});

function createCatalogPartida(id: string, description: string, unit: string, unitPrice: number): CatalogPartidaRecord {
  return {
    id,
    description,
    unit,
    unitPrice,
    currency: "PEN",
    source: null,
    performance: 1,
    performanceUnit: unit,
    performanceRate: `1.000 ${unit}/DIA`,
    apuRows: [],
  };
}
