import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { extractRowsFromMatrix, normalizeHeader, parseDateCell, parseLocalResourcePriceWorkbook } from "@/lib/local-resource-pricing/parser";

describe("local resource price parser", () => {
  it("normalizes Spanish headers and decimal separators", () => {
    expect(normalizeHeader("Precio unitario")).toBe("preciounitario");
    const rows = extractRowsFromMatrix([
      ["Código", "Descripción", "Unidad", "Moneda", "Precio unitario"],
      ["MAT-1", "Cemento", "bol", "PEN", "25,4500"],
    ]);
    expect(rows[0]).toMatchObject({ code: "MAT-1", description: "Cemento", proposedPrice: "25.4500" });
  });

  it("reads a real xlsx buffer and produces a stable file hash", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Precios");
    sheet.addRow(["resourceId", "code", "description", "unit", "currency", "unitPrice"]);
    sheet.addRow(["resource-1", "MAT-1", "Cemento", "bol", "PEN", 25.5]);
    const buffer = await workbook.xlsx.writeBuffer();
    const first = await parseLocalResourcePriceWorkbook(buffer);
    const second = await parseLocalResourcePriceWorkbook(buffer);
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0]?.resourceId).toBe("resource-1");
    expect(first.fileHash).toBe(second.fileHash);
    expect(first.worksheetName).toBe("Precios");
  });

  it("converts supported date cells to ISO", () => {
    expect(parseDateCell(new Date("2026-08-18T00:00:00.000Z"))).toBe("2026-08-18T00:00:00.000Z");
    expect(parseDateCell("not-a-date")).toBeUndefined();
  });
});
