import { describe, expect, it } from "vitest";
import PDFDocument from "pdfkit";
import { extractDigitalPdf } from "./digital-extraction";
import { extractDocument } from "@/lib/review-intelligence/extractors";

function pdfWithTwoDigitalPages(): File {
  const page = (text: string, id: number) => `${id} 0 obj\n<< /Length ${text.length + 32} >>\nstream\nBT /F1 12 Tf (${text}) Tj ET\nendstream\nendobj\n`;
  const body = `%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n${page("01.01 Concreto 12 m3 | Especificacion: f'c 210 | APU: cemento; arena", 2)}3 0 obj\n<< /Type /Page >>\nendobj\n${page("01.02 Acero 100 kg", 4)}trailer\n<< /Root 1 0 R >>\n%%EOF`;
  return new File([body], "digital.pdf", { type: "application/pdf" });
}

describe("digital PDF extraction", () => {
  it("extracts page count and text from digital PDF bytes without OCR", async () => {
    const result = await extractDigitalPdf(await pdfWithTwoDigitalPages().arrayBuffer());
    expect(result.pageCount).toBe(2);
    expect(result.pages).toEqual([
      expect.objectContaining({ page: 1, text: expect.stringContaining("Concreto") }),
      expect.objectContaining({ page: 2, text: expect.stringContaining("Acero") }),
    ]);
  });

  it("reconstructs TJ glyph chunks without inserting spaces inside words", async () => {
    const body = "%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n2 0 obj\n<< /Length 62 >>\nstream\nBT [(CON) 18 (CRE) 12 (TO) -260 ( m3)] TJ ET\nendstream\nendobj\ntrailer\n<<>>\n%%EOF";
    const result = await extractDigitalPdf(new TextEncoder().encode(body));
    expect(result.pages[0]?.text).toBe("CONCRETO m3");
  });

  it("extracts text and provenance from a PDFKit-generated digital PDF", async () => {
    const document = new PDFDocument({ autoFirstPage: true });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve) => document.on("end", () => resolve(Buffer.concat(chunks))));
    document.fontSize(12).text("01.01 Concreto 12 m3");
    document.addPage().fontSize(12).text("01.02 Acero 100 kg");
    document.end();
    const result = await extractDigitalPdf(await finished);
    expect(result.pageCount).toBe(2);
    expect(result.pages.map((page) => page.text)).toEqual(["01.01 Concreto 12 m3", "01.02 Acero 100 kg"]);
    expect(result.pages.map((page) => page.page)).toEqual([1, 2]);
    const structured = await extractDocument({ file: new File([await finished], "pdfkit.pdf", { type: "application/pdf" }) });
    expect(structured.pageCount).toBe(2);
    expect(structured.items.length).toBeGreaterThan(0);
    expect(structured.items.every((item) => typeof item.location.page === "number")).toBe(true);
  });
});
