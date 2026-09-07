import { describe, expect, it } from "vitest";
import { stageXlsxCsv } from "./xlsx-csv";
describe("xlsx/csv staging", () => {
  it("normalizes values and reports duplicate external keys without writing budgets", async () => { const result = await stageXlsxCsv({ sourceName: "obra.csv", rows: [{ codigo: " A-01 ", cantidad: "1,25" }, { codigo: "A-01", cantidad: "2" }] }); expect(result.rows[0]?.externalKey).toBe("A-01"); expect(result.conflicts[0]?.kind).toBe("DUPLICATE_EXTERNAL_KEY"); expect(result.payloadHash).toMatch(/^[a-f0-9]{64}$/); });
  it("detects required fields, incompatible units and formulas without evaluating them", async () => { const result = await stageXlsxCsv({ sourceName: "obra.xlsx", requiredColumns: ["description"], allowedUnits: ["m2"], rows: [{ codigo: "A-02", unit: "kg", quantity: "1,25", price: "1.234,50", formula: "=SUM(A1:A2)" }] }); expect(result.rows[0]?.values.quantity).toBe("1.25"); expect(result.rows[0]?.values.price).toBe("1234.50"); expect(result.conflicts.map((conflict) => conflict.kind)).toEqual(expect.arrayContaining(["MISSING_REQUIRED_COLUMN", "INCOMPATIBLE_UNIT", "FORMULA_NOT_EXECUTED"])); });
});
