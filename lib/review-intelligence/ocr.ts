import type { ConfidenceLevel, ExtractionCoverage, ExtractionMethod } from "./types";

export type OcrPageInput = {
  pageNumber: number;
  selectableText: string;
};

export type OcrExtractionInput = {
  companyId: string;
  projectId: string;
  documentVersionId: string;
  mimeType: "application/pdf";
  pages: OcrPageInput[];
};

export type OcrPageExtraction = {
  pageNumber: number;
  coverage: ExtractionCoverage;
  text: string;
  warnings: string[];
};

export type OcrExtractionResult = {
  method: ExtractionMethod;
  confidence: ConfidenceLevel;
  pages: OcrPageExtraction[];
};

export interface OcrAdapter {
  extractPages(input: OcrExtractionInput): Promise<OcrExtractionResult>;
}

export function createOcrAdapter(provider?: OcrAdapter): OcrAdapter {
  return provider ?? new UnavailableOcrAdapter();
}

class UnavailableOcrAdapter implements OcrAdapter {
  async extractPages(input: OcrExtractionInput): Promise<OcrExtractionResult> {
    assertOcrScope(input);
    return {
      method: "OCR_UNAVAILABLE",
      confidence: "LOW",
      pages: input.pages.map((page) => page.selectableText.trim().length > 0
        ? { pageNumber: page.pageNumber, coverage: "PROCESSED", text: page.selectableText, warnings: [] }
        : { pageNumber: page.pageNumber, coverage: "OCR_REQUIRED", text: "", warnings: ["OCR provider is not configured."] }),
    };
  }
}

function assertOcrScope(input: OcrExtractionInput): void {
  if (!input.companyId || !input.projectId || !input.documentVersionId) throw new Error("OCR extraction requires company, project and document version scope.");
  if (input.mimeType !== "application/pdf") throw new Error("OCR extraction only accepts PDF documents.");
  for (const page of input.pages) {
    if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1) throw new Error("OCR page numbers must be positive whole numbers.");
  }
}
