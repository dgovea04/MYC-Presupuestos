import { describe, expect, it } from "vitest";
import { parseGeneralExpensesTemplate } from "@/lib/general-expenses/template-parser";

describe("parseGeneralExpensesTemplate", () => {
  it("parses the workbook into fixed and variable groups with titles and items", async () => {
    const result = await parseGeneralExpensesTemplate("C:/MYC-Presupuestos/presupuesto-ejemplo/Gastos_Generales.xlsx");

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]).toMatchObject({
      code: "1",
      name: "GASTOS GENERALES FIJO",
      kind: "FIXED",
    });
    expect(result.groups[1]).toMatchObject({
      code: "2",
      name: "GASTOS GENERALES VARIABLES",
      kind: "VARIABLE",
    });

    expect(result.groups[0].titles[0]).toMatchObject({
      code: "1.1",
      name: "GASTOS DE ELABORACION DE LA PROPUESTA Y NOTARIALES",
      category: "STANDARD",
    });

    expect(result.groups[0].titles[0].items[0]).toMatchObject({
      code: "1.1.1",
      description: "ELABORACION DE PROPUESTA",
      category: "STANDARD",
      quantity: 1,
      participationPercentage: 0,
      unitPrice: 2000,
    });
  });

  it("maps direct-cost-based rows from the financial title", async () => {
    const result = await parseGeneralExpensesTemplate("C:/MYC-Presupuestos/presupuesto-ejemplo/Gastos_Generales.xlsx");
    const financialTitle = result.groups[1].titles.find((title) => title.code === "2.3");

    expect(financialTitle?.items[0]).toMatchObject({
      code: "2.3.1",
      category: "DIRECT_COST_BASED",
      quantity: 6,
      participationPercentage: 0.02,
      unitPrice: 661048.91,
    });
    expect(financialTitle?.category).toBe("DIRECT_COST_BASED");
  });
});
