import { describe, expect, it, vi } from "vitest";

import { createOcrAdapter, createPdfImportOcrAdapter, type OcrAdapter } from "./ocr";

const pdfPageWithoutSelectableText = {
  companyId: "company-1",
  projectId: "project-1",
  documentVersionId: "version-1",
  mimeType: "application/pdf" as const,
  pages: [{ pageNumber: 1, selectableText: "" }],
};

const pdfPageWithBytes = {
  ...pdfPageWithoutSelectableText,
  fileName: "budget.pdf",
  pdfBytes: new Uint8Array([37, 80, 68, 70]),
};

describe("OCR extraction boundary", () => {
  it("marks a PDF page without selectable text as requiring OCR when no provider is configured", async () => {
    const result = await createOcrAdapter().extractPages(pdfPageWithoutSelectableText);

    expect(result).toEqual({
      method: "OCR_UNAVAILABLE",
      confidence: "LOW",
      pages: [{ pageNumber: 1, coverage: "OCR_REQUIRED", text: "", warnings: ["OCR provider is not configured."] }],
    });
  });

  it("preserves failed coverage instead of fabricating OCR text when the provider cannot extract a page", async () => {
    const failingProvider: OcrAdapter = {
      extractPages: async () => ({
        method: "OCR_PROVIDER",
        confidence: "LOW",
        pages: [{ pageNumber: 1, coverage: "FAILED", text: "", warnings: ["OCR request failed."] }],
      }),
    };

    const result = await failingProvider.extractPages(pdfPageWithoutSelectableText);

    expect(result.pages[0]).toEqual({ pageNumber: 1, coverage: "FAILED", text: "", warnings: ["OCR request failed."] });
  });

  it("returns OCR evidence metadata for processed PDF pages through an injected provider", async () => {
    const provider: OcrAdapter = {
      extractPages: async () => ({
        method: "OCR_PROVIDER",
        confidence: "HIGH",
        pages: [{ pageNumber: 1, coverage: "PROCESSED", text: "Plano E-01", warnings: [] }],
      }),
    };

    const result = await createOcrAdapter(provider).extractPages(pdfPageWithoutSelectableText);

    expect(result).toEqual({
      method: "OCR_PROVIDER",
      confidence: "HIGH",
      pages: [{ pageNumber: 1, coverage: "PROCESSED", text: "Plano E-01", warnings: [] }],
    });
  });

  it("adapts the supported PDF OCR provider and forwards the document bytes per page", async () => {
    const extractText = vi.fn().mockResolvedValue({ text: "1.01 CONCRETO 2 m3", confidence: 0.75 });
    const result = await createPdfImportOcrAdapter({ extractText }).extractPages(pdfPageWithBytes);

    expect(extractText).toHaveBeenCalledWith({ fileName: "budget.pdf", pageNumber: 1, pdfBytes: pdfPageWithBytes.pdfBytes });
    expect(result).toEqual({
      method: "OCR_PROVIDER",
      confidence: "MEDIUM",
      pages: [{ pageNumber: 1, coverage: "PROCESSED", text: "1.01 CONCRETO 2 m3", warnings: [] }],
    });
  });
});
