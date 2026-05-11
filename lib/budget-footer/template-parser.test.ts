import { describe, expect, it } from "vitest";
import { parseBudgetFooterTemplate } from "@/lib/budget-footer/template-parser";

describe("parseBudgetFooterTemplate", () => {
  it("skips the header row from the excel template", async () => {
    const result = await parseBudgetFooterTemplate("C:/MYC-Presupuestos/presupuesto-ejemplo/pie-presupuesto.xlsx");

    expect(result.rows[0]).toMatchObject({
      variable: "CD",
      description: "COSTO DIRECTO",
    });
    expect(result.rows.some((row) => row.variable === "VARIABLE")).toBe(false);
  });
});
