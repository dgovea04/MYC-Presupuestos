import { describe, expect, it } from "vitest";
import { aggregateGeneralBudgetResources } from "@/lib/calculations/general-budget-sections";

describe("aggregateGeneralBudgetResources", () => {
  it("multiplica los recursos del APU por el metrado de cada partida", () => {
    const result = aggregateGeneralBudgetResources([
      {
        name: "Estructuras",
        items: [
          {
            quantity: 10,
            apu: {
              resources: [
                {
                  resourceId: "res-1",
                  quantity: 0.32,
                  subtotal: 5.28,
                  unitPrice: 16.5,
                  resource: {
                    id: "res-1",
                    code: "MO-013",
                    description: "PEON",
                    unit: "HH",
                    category: "LABOR",
                  },
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result.resources[0]).toMatchObject({
      totalQuantity: 3.2,
      totalCost: 52.8,
    });
  });

  it("recalcula el costo de recursos no porcentuales cuando el subtotal persistido está desactualizado", () => {
    const result = aggregateGeneralBudgetResources([
      {
        name: "Estructuras",
        items: [
          {
            quantity: 1,
            apu: {
              resources: [
                {
                  resourceId: "res-1",
                  quantity: 182.7864,
                  subtotal: 3010.06,
                  unitPrice: 16.5,
                  resource: {
                    id: "res-1",
                    code: "MO-013",
                    description: "PEON",
                    unit: "HH",
                    category: "LABOR",
                  },
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result.resources[0]?.totalCost).toBe(3015.98);
  });

  it("consolida insumos repetidos entre Sub Presupuestos y excluye insumos no resolubles", () => {
    const result = aggregateGeneralBudgetResources([
      {
        name: "Estructuras",
        items: [
          {
            quantity: 1,
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
            quantity: 1,
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

  it("ordena las categorías con mano de obra antes de materiales y equipos", () => {
    const result = aggregateGeneralBudgetResources([
      {
        name: "General",
        items: [
          {
            quantity: 1,
            apu: {
              resources: [
                {
                  resourceId: "equipment",
                  quantity: 1,
                  subtotal: 10,
                  unitPrice: 10,
                  resource: { id: "equipment", code: "EQ-001", description: "Equipo", unit: "HM", category: "EQUIPMENT" },
                },
                {
                  resourceId: "material",
                  quantity: 1,
                  subtotal: 10,
                  unitPrice: 10,
                  resource: { id: "material", code: "MAT-001", description: "Material", unit: "und", category: "MATERIAL" },
                },
                {
                  resourceId: "labor",
                  quantity: 1,
                  subtotal: 10,
                  unitPrice: 10,
                  resource: { id: "labor", code: "MO-001", description: "Mano de obra", unit: "HH", category: "LABOR" },
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(result.resources.map((resource) => resource.category)).toEqual(["LABOR", "MATERIAL", "EQUIPMENT"]);
  });
});
