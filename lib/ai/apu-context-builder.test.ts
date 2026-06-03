import { describe, expect, it } from "vitest";
import { buildApuCatalogContext } from "@/lib/ai/apu-context-builder";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

describe("apu-context-builder", () => {
  it("builds compact context with top partidas, top resources, rules, and schema", () => {
    const partidas: CatalogPartidaRecord[] = Array.from({ length: 8 }, (_, index) => ({
      id: `par-${index}`,
      description: index === 0 ? "Concreto f'c=210 kg/cm2 en columnas" : `Partida secundaria ${index}`,
      unit: index === 0 ? "m3" : "m2",
      unitPrice: 100 + index,
      currency: "PEN",
      performance: 10,
      apuRows: [
        {
          id: `row-${index}`,
          catalogPartidaId: `par-${index}`,
          resourceId: "res-0",
          description: "Cemento Portland Tipo I",
          unit: "und",
          quantity: 1,
          unitPrice: 1,
          subtotal: 1,
          resourceType: "MATERIAL",
          sortOrder: 0,
        },
      ],
    }));
    const resources: ResourceRecord[] = Array.from({ length: 35 }, (_, index) => ({
      id: `res-${index}`,
      code: `MAT-${index}`,
      description: index === 0 ? "Cemento Portland Tipo I" : `Recurso ${index}`,
      category: "MATERIAL",
      unit: "und",
      unitPrice: 1,
      currency: "PEN",
    }));

    const context = buildApuCatalogContext({
      query: "concreto fc 210 columnas cemento",
      unit: "m3",
      partidas,
      resources,
    });

    expect(context.query).toBe("concreto fc 210 columnas cemento");
    expect(context.similarPartidas).toHaveLength(3);
    expect(context.matchingResources).toHaveLength(15);
    expect(context.rules).toContain("Usa unicamente resource_id existentes en matchingResources.");
    expect(context.outputSchema.properties.items.items.properties.resource_id.enumFrom).toBe("matchingResources[].id");
    expect(context.outputSchema.properties.items.items.properties.type.enum).toEqual(["MATERIAL", "LABOR", "EQUIPMENT", "TOOLS", "SUBCONTRACT"]);
    expect(context.outputSchema.properties.items.items.properties.source.const).toBe("catalog");
  });

  it("prefers similar partidas with APU rows when available", () => {
    const partidas: CatalogPartidaRecord[] = [
      {
        id: "empty-exact",
        description: "ACERO DE REFUERZO F´Y = 4200 KG/CM2",
        unit: "KG",
        unitPrice: 4,
        currency: "PEN",
        performance: 1,
        apuRows: [],
      },
      {
        id: "filled-exact",
        description: "ACERO DE REFUERZO F´Y = 4200 KG/CM2",
        unit: "KG",
        unitPrice: 6,
        currency: "PEN",
        performance: 250,
        apuRows: [
          {
            id: "row-acero",
            catalogPartidaId: "filled-exact",
            resourceId: "res-acero",
            description: "ACERO CORRUGADO F'Y 4,200 KG/CM2",
            unit: "KG",
            quantity: 1.05,
            unitPrice: 3.85,
            subtotal: 4.04,
            resourceType: "MATERIAL",
            sortOrder: 0,
          },
        ],
      },
    ];
    const resources: ResourceRecord[] = [
      {
        id: "res-acero",
        code: "MAT-002",
        description: "ACERO CORRUGADO F'Y 4,200 KG/CM2",
        category: "MATERIAL",
        unit: "KG",
        unitPrice: 2.92,
        currency: "PEN",
      },
    ];

    const context = buildApuCatalogContext({
      query: "ACERO DE REFUERZO F´Y = 4200 KG/CM2",
      unit: "KG",
      partidas,
      resources,
    });

    expect(context.similarPartidas.map((partida) => partida.id)).toEqual(["filled-exact"]);
    expect(context.similarPartidas[0]?.apuRows).toHaveLength(1);
  });

  it("keeps similar partidas without APU rows when no APU-backed matches exist", () => {
    const partidas: CatalogPartidaRecord[] = [
      {
        id: "excavacion-manual-empty",
        description: "EXCAVACION MANUAL",
        unit: "m3",
        unitPrice: 35,
        currency: "PEN",
        performance: 8,
        apuRows: [],
      },
      {
        id: "nivelacion-terreno-empty",
        description: "NIVELACION EN TERRENO NORMAL",
        unit: "m2",
        unitPrice: 12,
        currency: "PEN",
        performance: 20,
        apuRows: [],
      },
    ];
    const resources: ResourceRecord[] = [
      {
        id: "res-peon",
        code: "MO-013",
        description: "PEON",
        category: "LABOR",
        unit: "HH",
        unitPrice: 16.85,
        currency: "PEN",
      },
    ];

    const context = buildApuCatalogContext({
      query: "EXCAVACION MANUAL H=1.00 EN TERRENO NORMAL",
      unit: "m3",
      partidas,
      resources,
    });

    expect(context.similarPartidas[0]?.id).toBe("excavacion-manual-empty");
    expect(context.similarPartidas[0]?.apuRows).toEqual([]);
  });

  it("finds excavation partidas by base name even when the query includes depth and terrain specs", () => {
    const partidas: CatalogPartidaRecord[] = [
      {
        id: "excavacion-manual",
        description: "EXCAVACION MANUAL EN TERRENO NORMAL",
        unit: "m3",
        unitPrice: 35,
        currency: "PEN",
        performance: 8,
        apuRows: [
          {
            id: "row-peon",
            catalogPartidaId: "excavacion-manual",
            resourceId: "res-peon",
            description: "PEON",
            unit: "HH",
            quantity: 0.8,
            unitPrice: 16.85,
            subtotal: 13.48,
            resourceType: "LABOR",
            sortOrder: 0,
          },
        ],
      },
      {
        id: "nivelacion-terreno",
        description: "NIVELACION EN TERRENO NORMAL",
        unit: "m2",
        unitPrice: 12,
        currency: "PEN",
        performance: 20,
        apuRows: [
          {
            id: "row-nivelacion",
            catalogPartidaId: "nivelacion-terreno",
            resourceId: "res-peon",
            description: "PEON",
            unit: "HH",
            quantity: 0.2,
            unitPrice: 16.85,
            subtotal: 3.37,
            resourceType: "LABOR",
            sortOrder: 0,
          },
        ],
      },
    ];
    const resources: ResourceRecord[] = [
      {
        id: "res-peon",
        code: "MO-013",
        description: "PEON",
        category: "LABOR",
        unit: "HH",
        unitPrice: 16.85,
        currency: "PEN",
      },
    ];

    const context = buildApuCatalogContext({
      query: "EXCAVACION MANUAL H=1.00 EN TERRENO NORMAL",
      unit: "m3",
      partidas,
      resources,
    });

    expect(context.similarPartidas[0]?.id).toBe("excavacion-manual");
  });
});
