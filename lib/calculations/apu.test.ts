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
});
