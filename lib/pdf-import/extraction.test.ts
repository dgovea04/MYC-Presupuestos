import { describe, expect, it, vi } from "vitest";

import { extractPdfImportFile } from "./extraction";
import type { PdfImportOcrProvider } from "./ocr";

describe("pdf import extraction", () => {
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
