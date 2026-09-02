import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { extractDocument } from "./extractors";
import { validateDocumentFile } from "./documents";

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
  return new File([bytes], "metrados.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

describe("review document extractors", () => {
  it("normalizes XLSX content with real sheet/range evidence and does not evaluate formulas or links", async () => {
    const result = await extractDocument({ file: await createWorkbookFile() });
    expect(result.kind).toBe("XLSX");
    expect(result.sheetCount).toBe(1);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ content: expect.stringContaining("01.01"), location: { sheet: "Metrado 01", range: "A1:D2" } }),
    ]));
    expect(result.items[0]?.content).toContain("[FORMULA:B2*2]");
    expect(result.items[0]?.content).toContain("source");
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("enlace")]));
  });

  it("rejects an XLSX extension when the bytes are not an OOXML workbook", async () => {
    const file = new File(["not a workbook"], "metrados.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    await expect(extractDocument({ file })).rejects.toThrow("MIME");
  });

  it("warns for OOXML macros, external links, external formulas and hyperlinks without executing them", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Safe").getCell("A1").value = "fixture";
    const bytes = await workbook.xlsx.writeBuffer();
    const zip = await JSZip.loadAsync(bytes);
    zip.file("xl/vbaProject.bin", new Uint8Array([0, 1, 2]));
    zip.file("xl/externalLinks/externalLink1.xml", "<externalLink><externalBook/></externalLink>");
    const worksheetEntry = zip.file("xl/worksheets/sheet1.xml");
    if (!worksheetEntry) throw new Error("Missing worksheet fixture");
    const worksheetXml = await worksheetEntry.async("string");
    zip.file("xl/worksheets/sheet1.xml", worksheetXml.replace("</worksheet>", "<hyperlinks><hyperlink ref=\"A1\"/></hyperlinks></worksheet>"));
    zip.file("xl/custom.xml", "<root><f>[Book.xlsx]Sheet1!A1</f></root>");
    const fixture = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const result = await extractDocument({ file: new File([fixture], "active.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) });
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("macro"),
      expect.stringContaining("extern"),
      expect.stringContaining("referencias"),
      expect.stringContaining("hiperv"),
    ]));
  });

  it("uses the compatible PDF importer and states that page count may be estimated and exact location is unavailable", async () => {
    const file = new File(["%PDF-1.7\nxref\n0 1\n0000000000 65535 f \n1 0 obj\n<</Subject (01.01 Trazo y replanteo m2 10 2.50 25.00)>>\nendobj\ntrailer\n<<>>\nstartxref\n9\n%%EOF"], "spec.pdf", { type: "application/pdf" });
    const result = await extractDocument({ file });
    expect(result.kind).toBe("PDF");
    expect(result.items[0]?.content).toContain("Trazo y replanteo");
    expect(result.items[0]?.location).toBeUndefined();
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("estimado"), expect.stringContaining("exacta")]));
  });

  it("accepts a PDF exactly at 50 MB and rejects empty or malformed documents", async () => {
    const bytes = new Uint8Array(50 * 1024 * 1024);
    bytes.set(new TextEncoder().encode("%PDF-1.7\n"));
    const structure = new TextEncoder().encode("xref\n0 1\n0000000000 65535 f \n1 0 obj\n<</Subject (boundary)>>\nendobj\ntrailer\n<<>>\nstartxref\n9\n%%EOF");
    bytes.set(structure, bytes.byteLength - structure.byteLength);
    await expect(validateDocumentFile(new File([bytes], "boundary.pdf", { type: "application/pdf" }))).resolves.toMatchObject({ fileSizeBytes: 50 * 1024 * 1024 });
    await expect(validateDocumentFile(new File([], "empty.pdf", { type: "application/pdf" }))).rejects.toThrow("MIME");
    await expect(validateDocumentFile(new File(["bad"], "bad.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))).rejects.toThrow("MIME");
  });

  it("rejects a PDF with a valid header but a malformed body", async () => {
    const malformed = new File(["%PDF-1.7\nnot a PDF body"], "malformed.pdf", { type: "application/pdf" });
    await expect(validateDocumentFile(malformed)).rejects.toThrow("MIME");
  });

  it("rejects a PDF with an invalid numeric xref offset", async () => {
    const malformed = new File(["%PDF-1.7\nxref\n0 1\n0000000000 65535 f \n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\nstartxref\nnot-a-number\n%%EOF"], "invalid-xref.pdf", { type: "application/pdf" });
    await expect(validateDocumentFile(malformed)).rejects.toThrow("MIME");
  });
});
