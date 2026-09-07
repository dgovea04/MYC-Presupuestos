import { describe, expect, it, vi } from "vitest";

import { extractPdfImportFile } from "./extraction";
import type { PdfImportOcrProvider } from "./ocr";

describe("pdf import extraction", () => {
  it("uses embedded digital PDF text instead of the raw PDF bytes", async () => {
    const pdf = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 45 >>
stream
BT /F1 12 Tf (PRESUPUESTO 01.01 Concreto m3 10 2.50 25.00) Tj ET
endstream
endobj
%%EOF`;

    const result = await extractPdfImportFile(new File([pdf], "Presupuesto.pdf", { type: "application/pdf" }));

    expect(result.requiresOcr).toBe(false);
    expect(result.role).toBe("BUDGET");
    expect(result.text).toContain("Concreto");
    expect(result.text).not.toContain("%PDF-1.7");
  });

  it("runs OCR once per page when a PDF has no embedded text", async () => {
    const pdf = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 3 /Kids [3 0 R 4 0 R 5 0 R] >>
endobj
3 0 obj << /Type /Page /Parent 2 0 R >> endobj
4 0 obj << /Type /Page /Parent 2 0 R >> endobj
5 0 obj << /Type /Page /Parent 2 0 R >> endobj
%%EOF`;
    const ocrProvider: PdfImportOcrProvider = {
      extractText: vi.fn(async ({ pageNumber }) => ({
        text: pageNumber === 1 ? "PRESUPUESTO 01.01 Concreto" : `Pagina ${pageNumber}`,
        confidence: 0.8,
      })),
    };

    const result = await extractPdfImportFile(new File([pdf], "scan.pdf", { type: "application/pdf" }), "AUTO", { ocrProvider });

    expect(result.requiresOcr).toBe(true);
    expect(result.ocrApplied).toBe(true);
    expect(result.role).toBe("BUDGET");
    expect(result.text).toContain("Pagina 3");
    expect(ocrProvider.extractText).toHaveBeenCalledTimes(3);
  });

  it("counts pages from PDF structure instead of form-feed bytes", async () => {
    const pdf = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 13 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 13 >>
stream
scan\fdata\fdata
endstream
endobj
%%EOF`;

    const result = await extractPdfImportFile(new File([pdf], "scan.pdf", { type: "application/pdf" }));

    expect(result.pageCount).toBe(13);
  });

  it("uses OCR provider when embedded text is too sparse", async () => {
    const ocrProvider: PdfImportOcrProvider = {
      extractText: vi.fn().mockResolvedValue({
        text: "01.01 Trazo y replanteo m2 10 2.50 25.00",
        confidence: 0.81,
      }),
    };

    const result = await extractPdfImportFile(new File([""], "scan.pdf", { type: "application/pdf" }), "AUTO", { ocrProvider });

    expect(result.text).toContain("Trazo y replanteo");
    expect(result.requiresOcr).toBe(true);
    expect(result.ocrApplied).toBe(true);
    expect(result.confidence).toBe(0.81);
    expect(ocrProvider.extractText).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "scan.pdf",
        pageNumber: 1,
      }),
    );
  });
});
