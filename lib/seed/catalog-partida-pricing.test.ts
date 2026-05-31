import { describe, expect, it } from "vitest";

import { priceSeedCatalogPartidaApuRows } from "@/lib/seed/catalog-partida-pricing";

describe("priceSeedCatalogPartidaApuRows", () => {
  it("uses resource catalog prices and recalculates row subtotals and partida unit price", () => {
    const result = priceSeedCatalogPartidaApuRows({
      performance: 10,
      rows: [
        {
          resourceId: "labor-1",
          description: "OPERARIO",
          unit: "HH",
          crew: 2,
          quantity: 99,
          unitPrice: 1,
          subtotal: 1,
          resourceType: "LABOR",
          groupLabel: "Mano de obra",
          sortOrder: 0,
        },
        {
          resourceId: "cement-1",
          description: "CEMENTO PORTLAND",
          unit: "BLS",
          crew: null,
          quantity: 3,
          unitPrice: 1,
          subtotal: 1,
          resourceType: "MATERIAL",
          groupLabel: "Materiales",
          sortOrder: 1,
        },
      ],
      resourcesById: new Map([
        ["labor-1", { unitPrice: 25, unit: "HH", category: "LABOR" }],
        ["cement-1", { unitPrice: 40, unit: "BLS", category: "MATERIAL" }],
      ]),
    });

    expect(result.rows).toMatchObject([
      { resourceId: "labor-1", quantity: 1.6, unitPrice: 25, subtotal: 40 },
      { resourceId: "cement-1", quantity: 3, unitPrice: 40, subtotal: 120 },
    ]);
    expect(result.unitPrice).toBe(160);
    expect(result.unresolvedRows).toEqual([]);
  });

  it("sets unresolved rows to zero and reports them instead of trusting partida workbook prices", () => {
    const result = priceSeedCatalogPartidaApuRows({
      performance: 1,
      rows: [
        {
          resourceId: null,
          description: "INSUMO SIN CATALOGO",
          unit: "UND",
          crew: null,
          quantity: 4,
          unitPrice: 99,
          subtotal: 396,
          resourceType: "MATERIAL",
          groupLabel: "Materiales",
          sortOrder: 0,
        },
      ],
      resourcesById: new Map(),
    });

    expect(result.rows).toMatchObject([{ unitPrice: 0, subtotal: 0 }]);
    expect(result.unitPrice).toBe(0);
    expect(result.unresolvedRows).toEqual([{ description: "INSUMO SIN CATALOGO", unit: "UND" }]);
  });
});
