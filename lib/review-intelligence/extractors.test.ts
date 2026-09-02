import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { extractDocument } from "./extractors";

async function createWorkbookFile(): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Metrado 01");
  sheet.getCell("A1").value = "Código";
  sheet.getCell("B1").value = "Cantidad";
  sheet.getCell("A2").value = "01.01";
  sheet.getCell("B2").value = 12.5;
  sheet.getCell("C2").value = { formula: "B2*2", result: 25 };
  sheet.getCell("D2").value = { text: "source", hyperlink: "https://example.test" };
  const bytes = await workbook.xlsx.writeBuffer();
  return new File([bytes], "metrados.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("review document extractors", () => {
  it("normalizes XLSX content with real sheet/range evidence and does not evaluate formulas or links", async () => {
    const result = await extractDocument({ file: await createWorkbookFile() });

    expect(result.kind).toBe("XLSX");
    expect(result.sheetCount).toBe(1);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        content: expect.stringContaining("01.01"),
        location: { sheet: "Metrado 01", range: "A1:D2" },
      }),
    ]));
    expect(result.items[0]?.content).toContain("[FORMULA:B2*2]");
    expect(result.items[0]?.content).toContain("source");
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("enlace"),
    ]));
  });

  it("rejects an XLSX extension when the bytes are not an OOXML workbook", async () => {
    const file = new File(["not a workbook"], "metrados.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await expect(extractDocument({ file })).rejects.toThrow("MIME");
  });

  it("uses the compatible PDF importer and preserves an explicit parser limitation warning", async () => {
    const file = new File(["%PDF-1.7\n01.01 Trazo y replanteo m2 10 2.50 25.00"], "spec.pdf", {
      type: "application/pdf",
    });

    const result = await extractDocument({ file });

    expect(result.kind).toBe("PDF");
    expect(result.items[0]?.content).toContain("Trazo y replanteo");
    expect(result.items[0]?.location).toBeUndefined();
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("página"),
    ]));
  });
});
