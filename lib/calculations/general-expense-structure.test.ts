import { describe, expect, it } from "vitest";
import { calculateGeneralExpenseStructure } from "@/lib/calculations/general-expense-structure";

describe("calculateGeneralExpenseStructure", () => {
  it("calculates standard item partials using quantity times unit price", () => {
    const result = calculateGeneralExpenseStructure({
      totalDirectCost: 1000,
      groups: [
        {
          id: "g1",
          name: "Fijo",
          kind: "FIXED",
          sortOrder: 0,
          titles: [
            {
              id: "t1",
              code: "1.1",
              name: "Titulo",
              category: "STANDARD",
              sortOrder: 0,
              items: [
                {
                  id: "i1",
                  code: "1.1.1",
                  description: "Item",
                  category: "STANDARD",
                  unit: "UND",
                  quantityDescription: "-",
                  quantity: 2,
                  participationPercentage: 0,
                  unitPrice: 50,
                  sortOrder: 0,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.groups[0].titles[0].items[0]).toMatchObject({
      code: "1.1.1",
      category: "STANDARD",
      quantity: 2,
      participationPercentage: 0,
      unitPrice: 50,
    });
    expect(result.groups[0].titles[0].items[0].partial).toBe(100);
    expect(result.groups[0].titles[0].subtotal).toBe(100);
    expect(result.groups[0].subtotal).toBe(100);
    expect(result.total).toBe(100);
  });

  it("uses numeric quantity descriptions as multipliers for standard item partials", () => {
    const result = calculateGeneralExpenseStructure({
      totalDirectCost: 1000,
      currencyDecimals: 2,
      groups: [
        {
          id: "g1",
          name: "Variable",
          kind: "VARIABLE",
          sortOrder: 0,
          titles: [
            {
              id: "t1",
              code: "2.2",
              name: "Servicios publicos",
              category: "STANDARD",
              sortOrder: 0,
              items: [
                {
                  id: "i1",
                  code: "2.2.4",
                  description: "Servicio de telefonia movil",
                  category: "STANDARD",
                  unit: "MES",
                  quantityDescription: "4",
                  quantity: 4,
                  participationPercentage: 0,
                  unitPrice: 29,
                  sortOrder: 0,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.groups[0].titles[0].items[0].partial).toBe(464);
    expect(result.groups[0].titles[0].subtotal).toBe(464);
    expect(result.total).toBe(464);
  });

  it("multiplies quantity description factors written as expressions", () => {
    const result = calculateGeneralExpenseStructure({
      totalDirectCost: 1000,
      currencyDecimals: 2,
      groups: [
        {
          id: "g1",
          name: "Fijo",
          kind: "FIXED",
          sortOrder: 0,
          titles: [
            {
              id: "t1",
              code: "1.1",
              name: "Titulo",
              category: "STANDARD",
              sortOrder: 0,
              items: [
                {
                  id: "i1",
                  code: "1.1.1",
                  description: "Item",
                  category: "STANDARD",
                  unit: "UND",
                  quantityDescription: "1 x 6",
                  quantity: 2,
                  participationPercentage: 0,
                  unitPrice: 10,
                  sortOrder: 0,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.groups[0].titles[0].items[0].partial).toBe(120);
  });

  it("calculates personal rows using percentage participation over unit price", () => {
    const result = calculateGeneralExpenseStructure({
      totalDirectCost: 637051.11,
      currencyDecimals: 2,
      groups: [
        {
          id: "g1",
          name: "Variable",
          kind: "VARIABLE",
          sortOrder: 0,
          titles: [
            {
              id: "t1",
              code: "2.1",
              name: "Personal de obra",
              category: "PERSONAL",
              sortOrder: 0,
              items: [
                {
                  id: "i1",
                  code: "2.1.1",
                  description: "Ingeniero residente de obra",
                  category: "PERSONAL",
                  unit: "MES",
                  quantityDescription: "1",
                  quantity: 4,
                  participationPercentage: 100,
                  unitPrice: 6000,
                  sortOrder: 0,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.groups[0].titles[0].items[0].participationPercentage).toBe(100);
    expect(result.groups[0].titles[0].items[0].partial).toBe(24000);
    expect(result.total).toBe(24000);
  });

  it("shows legacy personal participation fractions as displayed percentages", () => {
    const result = calculateGeneralExpenseStructure({
      totalDirectCost: 637051.11,
      currencyDecimals: 2,
      groups: [
        {
          id: "g1",
          name: "Variable",
          kind: "VARIABLE",
          sortOrder: 0,
          titles: [
            {
              id: "t1",
              code: "2.1",
              name: "Personal de obra",
              category: "PERSONAL",
              sortOrder: 0,
              items: [
                {
                  id: "i1",
                  code: "2.1.1",
                  description: "Ingeniero residente de obra",
                  category: "PERSONAL",
                  unit: "MES",
                  quantityDescription: "1",
                  quantity: 4,
                  participationPercentage: 1,
                  unitPrice: 6000,
                  sortOrder: 0,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.groups[0].titles[0].items[0].participationPercentage).toBe(100);
    expect(result.groups[0].titles[0].items[0].partial).toBe(24000);
  });

  it("calculates direct-cost-based item partials using quantity times percentage over 100 times direct cost", () => {
    const result = calculateGeneralExpenseStructure({
      totalDirectCost: 1000,
      currencyDecimals: 2,
      groups: [
        {
          id: "g1",
          name: "Variable",
          kind: "VARIABLE",
          sortOrder: 0,
          titles: [
            {
              id: "t1",
              code: "2.1",
              name: "Titulo",
              category: "DIRECT_COST_BASED",
              sortOrder: 0,
              items: [
                {
                  id: "i1",
                  code: "2.1.1",
                  description: "Tributos",
                  category: "DIRECT_COST_BASED",
                  unit: "%",
                  quantityDescription: "-",
                  quantity: 1,
                  participationPercentage: 0.03,
                  unitPrice: 0,
                  sortOrder: 0,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.groups[0].titles[0].items[0].partial).toBe(0.3);
    expect(result.total).toBe(0.3);
  });

  it("calculates financial expenses percentage rows from displayed percent values", () => {
    const result = calculateGeneralExpenseStructure({
      totalDirectCost: 637051.11,
      currencyDecimals: 2,
      groups: [
        {
          id: "g1",
          name: "Variable",
          kind: "VARIABLE",
          sortOrder: 0,
          titles: [
            {
              id: "t1",
              code: "2.3",
              name: "Gastos financieros",
              category: "DIRECT_COST_BASED",
              sortOrder: 0,
              items: [
                {
                  id: "i1",
                  code: "2.3.1",
                  description: "Cartas fianza fiel cumplimiento",
                  category: "DIRECT_COST_BASED",
                  unit: "%",
                  quantityDescription: "-",
                  quantity: 6,
                  participationPercentage: 0.02,
                  unitPrice: 0,
                  sortOrder: 0,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.groups[0].titles[0].items[0].partial).toBe(764.46);
    expect(result.total).toBe(764.46);
  });

  it("rounds unit prices, partials, subtotals, and totals using configured currency decimals", () => {
    const result = calculateGeneralExpenseStructure({
      totalDirectCost: 1000.005,
      currencyDecimals: 2,
      groups: [
        {
          id: "g1",
          name: "Fijo",
          kind: "FIXED",
          sortOrder: 0,
          titles: [
            {
              id: "t1",
              code: "1.1",
              name: "Titulo",
              category: "STANDARD",
              sortOrder: 0,
              items: [
                {
                  id: "i1",
                  code: "1.1.1",
                  description: "Item",
                  category: "STANDARD",
                  unit: "UND",
                  quantityDescription: "-",
                  quantity: 1,
                  participationPercentage: 0,
                  unitPrice: 3.335,
                  sortOrder: 0,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.groups[0].titles[0].items[0].unitPrice).toBe(3.34);
    expect(result.groups[0].titles[0].items[0].partial).toBe(3.34);
    expect(result.groups[0].titles[0].subtotal).toBe(3.34);
    expect(result.groups[0].subtotal).toBe(3.34);
    expect(result.total).toBe(3.34);
    expect(result.totalDirectCost).toBe(1000.01);
  });
});
