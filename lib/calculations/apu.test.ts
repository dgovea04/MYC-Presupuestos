import { describe, expect, it } from "vitest";
import { calculateApuRows, calculateApuSummary, calculateApuTotalUnitCost } from "@/lib/calculations/apu";

describe("calculateApuSummary", () => {
  it("returns the same derived rows and total unit cost as the dedicated helpers", () => {
    const rows = [
      {
        id: "labor-1",
        apuId: "apu-1",
        resourceId: "resource-1",
        resourceType: "LABOR",
        crew: 0.5,
        quantity: 0,
        unitPrice: 25,
        subtotal: 0,
        resource: {
          id: "resource-1",
          code: "MO-01",
          description: "Operario",
          category: "LABOR" as const,
          unit: "HH",
          unitPrice: 25,
          currency: "PEN",
        },
      },
      {
        id: "material-1",
        apuId: "apu-1",
        resourceId: "resource-2",
        resourceType: "MATERIAL",
        crew: null,
        quantity: 3.25,
        unitPrice: 12.4,
        subtotal: 0,
        resource: {
          id: "resource-2",
          code: "MAT-01",
          description: "Arena fina",
          category: "MATERIAL" as const,
          unit: "m3",
          unitPrice: 12.4,
          currency: "PEN",
        },
      },
      {
        id: "tools-1",
        apuId: "apu-1",
        resourceId: "resource-3",
        resourceType: "TOOLS",
        crew: null,
        quantity: 5,
        unitPrice: 0,
        subtotal: 0,
        resource: {
          id: "resource-3",
          code: "HM-01",
          description: "Herramientas manuales",
          category: "TOOLS" as const,
          unit: "%MO",
          unitPrice: 0,
          currency: "PEN",
        },
      },
    ];

    const summary = calculateApuSummary(rows, 10);

    expect(summary.rows).toEqual(calculateApuRows(rows, 10));
    expect(summary.totalUnitCost).toBe(calculateApuTotalUnitCost(rows, 10));
  });

  it("builds fixed category subtotals, folds tools into equipment, and recognizes subpartidas", () => {
    const rows = [
      {
        id: "labor-1",
        apuId: "apu-1",
        resourceId: "resource-1",
        resourceType: "LABOR",
        crew: null,
        quantity: 1.5,
        unitPrice: 20,
        subtotal: 0,
        resource: {
          id: "resource-1",
          code: "MO-01",
          description: "Oficial",
          category: "LABOR" as const,
          unit: "jor",
          unitPrice: 20,
          currency: "PEN",
        },
      },
      {
        id: "material-1",
        apuId: "apu-1",
        resourceId: "resource-2",
        resourceType: "MATERIAL",
        crew: null,
        quantity: 2,
        unitPrice: 15.5,
        subtotal: 0,
        resource: {
          id: "resource-2",
          code: "MAT-01",
          description: "Cemento",
          category: "MATERIAL" as const,
          unit: "bolsa",
          unitPrice: 15.5,
          currency: "PEN",
        },
      },
      {
        id: "equipment-1",
        apuId: "apu-1",
        resourceId: "resource-3",
        resourceType: "EQUIPMENT",
        crew: null,
        quantity: 0.5,
        unitPrice: 80,
        subtotal: 0,
        resource: {
          id: "resource-3",
          code: "EQ-01",
          description: "Mezcladora",
          category: "EQUIPMENT" as const,
          unit: "hm",
          unitPrice: 80,
          currency: "PEN",
        },
      },
      {
        id: "tools-1",
        apuId: "apu-1",
        resourceId: "resource-4",
        resourceType: "TOOLS",
        crew: null,
        quantity: 0.1,
        unitPrice: 50,
        subtotal: 0,
        resource: {
          id: "resource-4",
          code: "HM-01",
          description: "Herramientas",
          category: "TOOLS" as const,
          unit: "glb",
          unitPrice: 50,
          currency: "PEN",
        },
      },
      {
        id: "subcontract-1",
        apuId: "apu-1",
        resourceId: "resource-5",
        resourceType: "SUBCONTRACT",
        crew: null,
        quantity: 1,
        unitPrice: 200,
        subtotal: 0,
        resource: {
          id: "resource-5",
          code: "SC-01",
          description: "Instalacion tercerizada",
          category: "EQUIPMENT" as const,
          unit: "glb",
          unitPrice: 200,
          currency: "PEN",
        },
      },
      {
        id: "subpartida-1",
        apuId: "apu-1",
        resourceId: "resource-6",
        resourceType: "SUBPARTIDA",
        crew: null,
        quantity: 1,
        unitPrice: 125,
        subtotal: 0,
        resource: {
          id: "resource-6",
          code: "SP-01",
          description: "Sub partida prefabricada",
          category: "MATERIAL" as const,
          unit: "glb",
          unitPrice: 125,
          currency: "PEN",
        },
      },
    ];

    const summary = calculateApuSummary(rows, 8);

    expect(summary.categoryTotals).toEqual([
      { category: "LABOR", subtotal: 30 },
      { category: "MATERIAL", subtotal: 31 },
      { category: "EQUIPMENT", subtotal: 45 },
      { category: "SUBCONTRACT", subtotal: 200 },
      { category: "SUBPARTIDA", subtotal: 125 },
    ]);
    expect(summary.totalUnitCost).toBe(431);
    expect(summary.rows).toEqual(calculateApuRows(rows, 8));
  });

  it("calculates equipment quantity from crew and performance for machine-hour units", () => {
    const [row] = calculateApuRows(
      [
        {
          id: "equipment-1",
          apuId: "apu-1",
          resourceId: "resource-1",
          resourceType: "EQUIPMENT",
          crew: 2,
          quantity: 0,
          unitPrice: 80,
          subtotal: 0,
          resource: {
            id: "resource-1",
            code: "EQ-01",
            description: "Rodillo vibratorio",
            category: "EQUIPMENT" as const,
            unit: "HM",
            unitPrice: 80,
            currency: "PEN",
          },
        },
      ],
      8,
    );

    expect(row?.quantity).toBe(2);
    expect(row?.subtotal).toBe(160);
  });

  it("uses the row unit price as base for generic percentage resources", () => {
    const [row] = calculateApuRows(
      [
        {
          id: "percent-1",
          apuId: "apu-1",
          resourceId: "resource-1",
          resourceType: "MATERIAL",
          crew: null,
          quantity: 20,
          unitPrice: 232.76,
          subtotal: 0,
          resource: {
            id: "resource-1",
            code: "MAT-PCT",
            description: "Accesorios",
            category: "MATERIAL" as const,
            unit: "%",
            unitPrice: 232.76,
            currency: "PEN",
          },
        },
      ],
      1,
    );

    expect(row?.quantity).toBe(20);
    expect(row?.unitPrice).toBe(232.76);
    expect(row?.subtotal).toBe(46.55);
  });

  it("lets generic percentage labor feed later %MO resources", () => {
    const rows = calculateApuRows(
      [
        {
          id: "labor-percent",
          apuId: "apu-1",
          resourceId: "resource-1",
          resourceType: "LABOR",
          crew: null,
          quantity: 40,
          unitPrice: 52.38,
          subtotal: 0,
          resource: {
            id: "resource-1",
            code: "MO-PCT",
            description: "Mano de obra de instalacion",
            category: "LABOR" as const,
            unit: "%",
            unitPrice: 52.38,
            currency: "PEN",
          },
        },
        {
          id: "tools-percent",
          apuId: "apu-1",
          resourceId: "resource-2",
          resourceType: "TOOLS",
          crew: null,
          quantity: 3,
          unitPrice: 20.95,
          subtotal: 0,
          resource: {
            id: "resource-2",
            code: "TOOLS-PCT",
            description: "Herramientas manuales",
            category: "TOOLS" as const,
            unit: "%MO",
            unitPrice: 20.95,
            currency: "PEN",
          },
        },
      ],
      1,
    );

    expect(rows.map((row) => row.subtotal)).toEqual([20.95, 0.63]);
  });
});
