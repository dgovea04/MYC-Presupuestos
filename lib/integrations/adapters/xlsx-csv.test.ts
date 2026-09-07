import { describe, expect, it } from "vitest";
import { stageXlsxCsv } from "./xlsx-csv";
import ExcelJS from "exceljs";
import { vi } from "vitest";
vi.mock("@/lib/review-intelligence/extractors", () => ({ extractDocument: vi.fn(async () => ({ items: [{ content: "Concreto", metadata: { code: "01", description: "Concreto", quantity: "2", unit: "m3" }, location: { sheet: "Metrados", range: "A2:D2" } }] })) }));
describe("xlsx/csv staging", () => {
  it("normalizes values and reports duplicate external keys without writing budgets", async () => { const result = await stageXlsxCsv({ sourceName: "obra.csv", rows: [{ codigo: " A-01 ", cantidad: "1,25" }, { codigo: "A-01", cantidad: "2" }] }); expect(result.rows[0]?.externalKey).toBe("A-01"); expect(result.conflicts[0]?.kind).toBe("DUPLICATE_EXTERNAL_KEY"); expect(result.payloadHash).toMatch(/^[a-f0-9]{64}$/); });
  it("detects required fields, incompatible units and formulas without evaluating them", async () => { const result = await stageXlsxCsv({ sourceName: "obra.xlsx", requiredColumns: ["description"], allowedUnits: ["m2"], rows: [{ codigo: "A-02", unit: "kg", quantity: "1,25", price: "1.234,50", formula: "=SUM(A1:A2)" }] }); expect(result.rows[0]?.values.quantity).toBe("1.25"); expect(result.rows[0]?.values.price).toBe("1234.50"); expect(result.conflicts.map((conflict) => conflict.kind)).toEqual(expect.arrayContaining(["MISSING_REQUIRED_COLUMN", "INCOMPATIBLE_UNIT", "FORMULA_NOT_EXECUTED"])); });
  it("uses the real XLSX/CSV extraction parser when given file bytes", async () => { const workbook = new ExcelJS.Workbook(); workbook.addWorksheet("Metrados").addRow(["Código", "Descripción", "Metrado", "Unidad"]); const buffer = await workbook.xlsx.writeBuffer(); const result = await stageXlsxCsv({ sourceName: "obra.xlsx", buffer }); expect(result.rows[0]?.externalKey).toBe("01"); expect(result.rows[0]?.provenance).toEqual({ source: "obra.xlsx", row: 1 }); });
});
