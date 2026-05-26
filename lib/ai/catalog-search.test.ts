import { describe, expect, it } from "vitest";
import { searchCatalogPartidas, searchCatalogResources } from "@/lib/ai/catalog-search";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

const partidas: CatalogPartidaRecord[] = [
  {
    id: "par-concreto-columnas",
    description: "Concreto f'c=210 kg/cm2 en columnas",
    unit: "m3",
    unitPrice: 280,
    currency: "PEN",
    performance: 12,
    apuRows: [
      {
        id: "row-cemento",
        catalogPartidaId: "par-concreto-columnas",
        resourceId: "res-cemento",
        description: "Cemento Portland Tipo I",
        unit: "bol",
        quantity: 7.5,
        unitPrice: 32,
        subtotal: 240,
        resourceType: "MATERIAL",
        sortOrder: 0,
      },
    ],
  },
  {
    id: "par-tarrajeo",
    description: "Tarrajeo en muros interiores",
    unit: "m2",
    unitPrice: 45,
    currency: "PEN",
    performance: 20,
    apuRows: [],
  },
];

const resources: ResourceRecord[] = [
  {
    id: "res-cemento",
    code: "MAT-001",
    description: "Cemento Portland Tipo I",
    category: "MATERIAL",
    unit: "bol",
    unitPrice: 32,
    currency: "PEN",
  },
  {
    id: "res-operario",
    code: "MO-001",
    description: "Operario",
    category: "LABOR",
    unit: "hh",
    unitPrice: 25,
    currency: "PEN",
  },
  {
    id: "res-pintura",
    code: "MAT-009",
    description: "Pintura latex",
    category: "MATERIAL",
    unit: "gal",
    unitPrice: 58,
    currency: "PEN",
  },
];

describe("catalog-search", () => {
  it("ranks catalog partidas by normalized construction keywords", () => {
    const result = searchCatalogPartidas({
      query: "concreto fc 210 para columnas",
      unit: "m3",
      partidas,
      limit: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.partida.id).toBe("par-concreto-columnas");
    expect(result[0]?.similarity).toBeGreaterThan(0.6);
  });

  it("uses partida APU row text to retrieve relevant catalog resources", () => {
    const result = searchCatalogResources({
      query: "concreto columnas",
      similarPartidas: searchCatalogPartidas({
        query: "concreto columnas",
        partidas,
        limit: 1,
      }),
      resources,
      limit: 2,
    });

    expect(result.map((item) => item.resource.id)).toContain("res-cemento");
    expect(result[0]?.score).toBeGreaterThan(result[1]?.score ?? 0);
  });

  it("prioritizes the partida base name over technical specifications in long queries", () => {
    const excavationPartidas: CatalogPartidaRecord[] = [
      {
        id: "par-excavacion-manual",
        description: "EXCAVACION MANUAL EN TERRENO NORMAL",
        unit: "m3",
        unitPrice: 35,
        currency: "PEN",
        performance: 8,
        apuRows: [],
      },
      {
        id: "par-terreno-normal",
        description: "NIVELACION EN TERRENO NORMAL",
        unit: "m2",
        unitPrice: 12,
        currency: "PEN",
        performance: 20,
        apuRows: [],
      },
      {
        id: "par-relleno",
        description: "RELLENO CON MATERIAL PROPIO",
        unit: "m3",
        unitPrice: 28,
        currency: "PEN",
        performance: 10,
        apuRows: [],
      },
    ];

    const result = searchCatalogPartidas({
      query: "EXCAVACION MANUAL H=1.00 EN TERRENO NORMAL",
      unit: "m3",
      partidas: excavationPartidas,
      limit: 3,
    });

    expect(result[0]?.partida.id).toBe("par-excavacion-manual");
    expect(result[0]?.similarity).toBeGreaterThan(0.75);
  });
});
