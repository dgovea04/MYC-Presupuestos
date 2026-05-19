import { describe, expect, it } from "vitest";
import { aggregateGeneralBudgetResources } from "@/lib/calculations/general-budget-sections";

describe("aggregateGeneralBudgetResources", () => {
  it("consolida insumos repetidos entre Sub Presupuestos y excluye insumos no resolubles", () => {
    const result = aggregateGeneralBudgetResources([
      {
        name: "Estructuras",
        items: [
          {
            apu: {
              resources: [
                {
                  resourceId: "res-1",
                  quantity: 2,
                  subtotal: 10,
                  unitPrice: 5,
                  resource: {
                    id: "res-1",
                    code: "MAT-01",
                    description: "Cemento",
                    unit: "BLS",
                    category: "MATERIAL",
                  },
                },
                {
                  resourceId: null,
                  quantity: 1,
                  subtotal: 4,
                  unitPrice: 4,
                  resource: null,
                },
              ],
            },
          },
        ],
      },
      {
        name: "Arquitectura",
        items: [
          {
            apu: {
              resources: [
                {
                  resourceId: "res-1",
                  quantity: 3,
                  subtotal: 15,
                  unitPrice: 5,
                  resource: {
                    id: "res-1",
                    code: "MAT-01",
                    description: "Cemento",
                    unit: "BLS",
                    category: "MATERIAL",
                  },
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result.unresolvedCount).toBe(1);
    expect(result.budgetCount).toBe(2);
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]).toMatchObject({
      resourceId: "res-1",
      code: "MAT-01",
      description: "Cemento",
      totalQuantity: 5,
      totalCost: 25,
      usageCount: 2,
      budgetNames: ["Arquitectura", "Estructuras"],
    });
  });
});
