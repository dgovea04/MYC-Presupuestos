import { describe, expect, it } from "vitest";
import { aggregateSuggestedInsumos } from "@/lib/partida-generation/aggregation";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

describe("aggregateSuggestedInsumos", () => {
  it("groups repeated insumos, calculates stats, confidence, and weighted median quantities", () => {
    const suggestions = aggregateSuggestedInsumos({
      selectedPartidas: [
        { partida: createPartida("p1", "Concreto columnas", [row("r-cemento", "Cemento Portland", "bol", 0.9, 24)]), score: 0.96, isPrimary: true },
        { partida: createPartida("p2", "Concreto placas", [row("r-cemento", "Cemento Portland", "bol", 0.85, 23)]), score: 0.84 },
        { partida: createPartida("p3", "Concreto vigas", [row("r-cemento", "Cemento Portland", "bol", 1.1, 22)]), score: 0.79 },
        { partida: createPartida("p4", "Encofrado", [row("r-madera", "Madera tornillo", "p2", 2.5, 12)]), score: 0.4 },
      ],
      resources: [
        resource("r-cemento", "Cemento Portland", "bol", 25),
        resource("r-madera", "Madera tornillo", "p2", 11.5),
      ],
    });

    const cemento = suggestions.find((suggestion) => suggestion.resourceId === "r-cemento");
    const madera = suggestions.find((suggestion) => suggestion.resourceId === "r-madera");

    expect(cemento).toEqual(
      expect.objectContaining({
        description: "Cemento Portland",
        unit: "bol",
        frequency: 0.75,
        confidenceLevel: "review",
        suggestedQuantity: 0.9,
        unitPrice: 25,
        priceSource: "catalog",
        calculationMethod: "weighted_median",
      }),
    );
    expect(cemento?.statistics).toEqual({
      average: 0.95,
      median: 0.9,
      minimum: 0.85,
      maximum: 1.1,
      standardDeviation: 0.108,
    });
    expect(madera?.confidenceLevel).toBe("optional");
  });

  it("does not invent prices when a catalog resource cannot be matched", () => {
    const suggestions = aggregateSuggestedInsumos({
      selectedPartidas: [
        { partida: createPartida("p1", "Partida A", [row(null, "Aditivo especial", "gal", 0.2, 99)]), score: 0.9 },
        { partida: createPartida("p2", "Partida B", [row(null, "Aditivo especial", "gal", 0.3, 101)]), score: 0.8 },
      ],
      resources: [],
    });

    expect(suggestions[0]).toEqual(
      expect.objectContaining({
        resourceId: null,
        unitPrice: null,
        priceSource: "unmatched",
      }),
    );
  });
});

function createPartida(id: string, description: string, apuRows: CatalogPartidaRecord["apuRows"]): CatalogPartidaRecord {
  return {
    id,
    description,
    unit: "m3",
    unitPrice: 0,
    currency: "PEN",
    performance: 1,
    apuRows,
  };
}

function row(resourceId: string | null, description: string, unit: string, quantity: number, unitPrice: number) {
  return {
    id: `${description}-${quantity}`,
    catalogPartidaId: "source",
    resourceId,
    description,
    unit,
    quantity,
    unitPrice,
    subtotal: quantity * unitPrice,
    resourceType: "MATERIAL",
    sortOrder: 0,
  };
}

function resource(id: string, description: string, unit: string, unitPrice: number): ResourceRecord {
  return {
    id,
    code: id,
    description,
    category: "MATERIAL",
    unit,
    unitPrice,
    currency: "PEN",
  };
}
