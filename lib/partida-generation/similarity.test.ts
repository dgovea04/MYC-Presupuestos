import { describe, expect, it } from "vitest";
import { searchSimilarPartidas } from "@/lib/partida-generation/similarity";
import type { CatalogPartidaRecord } from "@/types/partida";

describe("searchSimilarPartidas", () => {
  it("ranks candidates with deterministic weighted scores", () => {
    const results = searchSimilarPartidas({
      query: "Concreto armado f'c=210 kg/cm2 para columnas",
      unit: "m3",
      partidas: [
        createPartida("p1", "Concreto armado f'c=210 kg/cm2 en columnas", "m3"),
        createPartida("p2", "Concreto armado f'c=210 kg/cm2 en placas", "m3"),
        createPartida("p3", "Concreto armado f'c=175 kg/cm2 en columnas", "m3"),
        createPartida("p4", "Encofrado y desencofrado normal en columnas", "m2"),
      ],
      limit: 4,
    });

    expect(results.map((result) => result.partida.id)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(results[0]?.score).toBeGreaterThan(0.95);
    expect(results[1]?.score).toBeGreaterThan(results[2]?.score ?? 0);
    expect(results[0]?.breakdown.element).toBe(1);
    expect(results[0]?.breakdown.technical).toBe(1);
    expect(results[3]?.score).toBeLessThan(0.45);
  });

  it("uses resource composition as a deterministic tie breaker without changing the weighted formula", () => {
    const results = searchSimilarPartidas({
      query: "Tarrajeo en muros interiores mezcla 1:5",
      unit: "m2",
      partidas: [
        createPartida("p1", "Tarrajeo en muros exteriores mezcla 1:5", "m2", ["Cemento Portland", "Arena fina", "Operario"]),
        createPartida("p2", "Tarrajeo en muros interiores mezcla 1:5", "m2", ["Cemento Portland", "Arena fina", "Peon"]),
      ],
      referenceResourceNames: ["Cemento Portland", "Arena fina", "Peon"],
      limit: 2,
    });

    expect(results.map((result) => result.partida.id)).toEqual(["p2", "p1"]);
    expect(results[0]?.compositionSimilarity).toBeGreaterThan(results[1]?.compositionSimilarity ?? 0);
  });
});

function createPartida(id: string, description: string, unit: string, apuDescriptions: string[] = []): CatalogPartidaRecord {
  return {
    id,
    description,
    unit,
    unitPrice: 0,
    currency: "PEN",
    performance: 1,
    apuRows: apuDescriptions.map((rowDescription, index) => ({
      id: `${id}-row-${index}`,
      catalogPartidaId: id,
      description: rowDescription,
      unit: "und",
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
      sortOrder: index,
    })),
  };
}
