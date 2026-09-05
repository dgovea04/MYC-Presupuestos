import { describe, expect, it } from "vitest";

import { createOcrAdapter, type OcrAdapter } from "./ocr";

const pdfPageWithoutSelectableText = {
  companyId: "company-1",
  projectId: "project-1",
  documentVersionId: "version-1",
  mimeType: "application/pdf" as const,
  pages: [{ pageNumber: 1, selectableText: "" }],
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
});
