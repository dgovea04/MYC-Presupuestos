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

  it("calculates direct-cost-based item partials using quantity times percentage times direct cost", () => {
    const result = calculateGeneralExpenseStructure({
      totalDirectCost: 1000,
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

    expect(result.groups[0].titles[0].items[0].partial).toBe(30);
    expect(result.total).toBe(30);
  });
});
