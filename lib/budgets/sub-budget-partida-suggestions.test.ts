import { describe, expect, it } from "vitest";
import { suggestPartidaMatches } from "@/lib/budgets/sub-budget-partida-suggestions";
import type { CatalogPartidaRecord } from "@/types/partida";

describe("suggestPartidaMatches", () => {
  const catalog = [
    createCatalogPartida({
      id: "catalog-1",
      description: "Excavacion manual",
      unit: "m3",
      unitPrice: 120,
    }),
    createCatalogPartida({
      id: "catalog-2",
      description: "Excavacion con maquinaria",
      unit: "m3",
      unitPrice: 150,
    }),
    createCatalogPartida({
      id: "catalog-3",
      description: "Relleno compactado con material propio",
      unit: "m3",
      unitPrice: 95,
    }),
    createCatalogPartida({
      id: "catalog-4",
      description: "Excavacion manual",
      unit: "m2",
      unitPrice: 88,
    }),
  ];

  it("returns an exact match when description and unit normalize to the same value", () => {
    const result = suggestPartidaMatches({
      item: {
        code: "IT-1",
        description: "  Excavación  manual ",
        unit: "m3",
      },
      catalog,
    });

    expect(result.matchKind).toBe("exact");
    expect(result.exactMatch?.id).toBe("catalog-1");
    expect(result.bestSuggestion?.id).toBe("catalog-1");
    expect(result.suggestions[0]?.confidence).toBe("high");
  });

  it("returns an exact description match when there is only one valid candidate for that description", () => {
    const result = suggestPartidaMatches({
      item: {
        code: "IT-2",
        description: "Relleno compactado con material propio",
        unit: "",
      },
      catalog,
    });

    expect(result.matchKind).toBe("exact");
    expect(result.exactMatch?.id).toBe("catalog-3");
  });

  it("orders suggestions from highest to lowest score", () => {
    const result = suggestPartidaMatches({
      item: {
        code: "IT-3",
        description: "Excavacion manual en zanja",
        unit: "m3",
      },
      catalog,
      limit: 3,
    });

    expect(result.matchKind).toBe("suggested");
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions[0]!.partida.id).toBe("catalog-1");
    expect(result.suggestions[0]!.score).toBeGreaterThan(result.suggestions[1]!.score);
    expect(result.suggestions[1]!.score).toBeGreaterThan(result.suggestions[2]!.score);
  });

  it("boosts the confidence when the unit matches", () => {
    const matchingUnit = suggestPartidaMatches({
      item: {
        code: "IT-4",
        description: "Excavacion manual en zanja",
        unit: "m3",
      },
      catalog,
      limit: 3,
    });

    const differentUnit = suggestPartidaMatches({
      item: {
        code: "IT-5",
        description: "Excavacion manual en zanja",
        unit: "kg",
      },
      catalog,
      limit: 3,
    });

    expect(matchingUnit.suggestions[0]?.partida.id).toBe("catalog-1");
    expect(differentUnit.suggestions[0]?.partida.id).toBe("catalog-1");
    expect(matchingUnit.suggestions[0]?.confidence).toBe("high");
    expect(differentUnit.suggestions[0]?.confidence).not.toBe("high");
  });

  it("penalizes or excludes candidates with a different unit", () => {
    const result = suggestPartidaMatches({
      item: {
        code: "IT-6",
        description: "Relleno compactado propio",
        unit: "kg",
      },
      catalog,
      limit: 3,
    });

    expect(result.matchKind).toBe("suggested");
    expect(result.suggestions.every((suggestion) => suggestion.confidence !== "high")).toBe(true);
  });

  it("leaves highly ambiguous very short text unresolved", () => {
    const result = suggestPartidaMatches({
      item: {
        code: "IT-7",
        description: "Obra",
        unit: "m3",
      },
      catalog,
    });

    expect(result.matchKind).toBe("unresolved");
    expect(result.exactMatch).toBeNull();
    expect(result.bestSuggestion).toBeNull();
    expect(result.suggestions).toEqual([]);
  });
});

function createCatalogPartida(
  overrides: Pick<CatalogPartidaRecord, "id" | "description" | "unit" | "unitPrice">,
): CatalogPartidaRecord {
  return {
    id: overrides.id,
    description: overrides.description,
    unit: overrides.unit,
    unitPrice: overrides.unitPrice,
    currency: "PEN",
    source: null,
    performance: 1,
    performanceUnit: "m3",
    performanceRate: "1.000 m3/DIA",
    apuRows: [],
  };
}
