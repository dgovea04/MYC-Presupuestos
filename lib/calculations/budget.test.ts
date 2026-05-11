import { describe, expect, it } from "vitest";
import { calculateBudgetRecord } from "@/lib/calculations/budget";

describe("calculateBudgetRecord", () => {
  it("recalcula el presupuesto a partir de recursos APU, tasas y metrados", () => {
    const result = calculateBudgetRecord({
      id: "budget-test",
      projectId: "project-test",
      parentBudgetId: null,
      kind: "GENERAL",
      name: "Test",
      currency: "PEN",
      igvRate: 0.18,
      generalExpensesRate: 0.1,
      utilityRate: 0.08,
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      totalUtility: 0,
      totalTax: 0,
      totalAmount: 0,
      levels: [],
      items: [
        {
          id: "item-1",
          budgetId: "budget-test",
          code: "01.01",
          description: "Partida",
          unit: "m2",
          quantity: 10,
          unitPrice: 0,
          partial: 0,
          sortOrder: 1,
          apu: {
            id: "apu-1",
            budgetItemId: "item-1",
            name: "APU",
            unit: "m2",
            performance: 1,
            totalUnitCost: 0,
            resources: [
              { id: "r1", apuId: "apu-1", resourceId: "res-1", resourceType: "MATERIAL", quantity: 2, unitPrice: 5, subtotal: 0 },
              { id: "r2", apuId: "apu-1", resourceId: "res-2", resourceType: "LABOR", quantity: 1, unitPrice: 8, subtotal: 0 },
            ],
          },
        },
      ],
    });

    expect(result.items[0].unitPrice).toBe(18);
    expect(result.items[0].partial).toBe(180);
    expect(result.totals.totalDirectCost).toBe(180);
    expect(result.totals.totalGeneralExpenses).toBe(18);
    expect(result.totals.totalUtility).toBe(14.4);
    expect(result.totals.totalTax).toBe(38.232);
    expect(result.totals.totalAmount).toBe(250.632);
  });

  it("calcula cantidades por cuadrilla y recursos porcentuales como %MO", () => {
    const result = calculateBudgetRecord({
      id: "budget-apu",
      projectId: "project-test",
      parentBudgetId: null,
      kind: "GENERAL",
      name: "Test",
      currency: "PEN",
      igvRate: 0.18,
      generalExpensesRate: 0,
      utilityRate: 0,
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      totalUtility: 0,
      totalTax: 0,
      totalAmount: 0,
      levels: [],
      items: [
        {
          id: "item-1",
          budgetId: "budget-test",
          code: "01.01",
          description: "Limpieza manual",
          unit: "m2",
          quantity: 1,
          unitPrice: 0,
          partial: 0,
          sortOrder: 1,
          apu: {
            id: "apu-1",
            budgetItemId: "item-1",
            name: "APU",
            unit: "m2",
            performance: 25,
            totalUnitCost: 0,
            resources: [
              {
                id: "labor-1",
                apuId: "apu-1",
                resourceId: "res-1",
                resourceType: "LABOR",
                crew: 0.1,
                quantity: 0,
                unitPrice: 19.23,
                subtotal: 0,
                resource: {
                  id: "res-1",
                  code: "MO-01",
                  description: "Operario",
                  category: "LABOR",
                  unit: "HH",
                  unitPrice: 19.23,
                  currency: "PEN",
                },
              },
              {
                id: "labor-2",
                apuId: "apu-1",
                resourceId: "res-2",
                resourceType: "LABOR",
                crew: 1,
                quantity: 0,
                unitPrice: 16.5,
                subtotal: 0,
                resource: {
                  id: "res-2",
                  code: "MO-02",
                  description: "Peon",
                  category: "LABOR",
                  unit: "HH",
                  unitPrice: 16.5,
                  currency: "PEN",
                },
              },
              {
                id: "eq-1",
                apuId: "apu-1",
                resourceId: "res-3",
                resourceType: "EQUIPMENT",
                crew: null,
                quantity: 5,
                unitPrice: 0,
                subtotal: 0,
                resource: {
                  id: "res-3",
                  code: "EQ-01",
                  description: "Herramientas manuales",
                  category: "EQUIPMENT",
                  unit: "%MO",
                  unitPrice: 0,
                  currency: "PEN",
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.items[0].unitPrice).toBe(6.2);
    expect(result.items[0].apu?.resources.map((resource) => resource.quantity)).toEqual([0.032, 0.32, 5]);
    expect(result.items[0].apu?.resources.map((resource) => resource.unitPrice)).toEqual([19.23, 16.5, 5.9]);
    expect(result.items[0].apu?.resources.map((resource) => resource.subtotal)).toEqual([0.62, 5.28, 0.3]);
  });
});
