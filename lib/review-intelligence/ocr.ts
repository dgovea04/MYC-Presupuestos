import type { ConfidenceLevel, ExtractionCoverage, ExtractionMethod } from "./types";
import type { PdfImportOcrProvider } from "@/lib/pdf-import/ocr";

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
  fileName?: string;
  pdfBytes?: Uint8Array;
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

export function createPdfImportOcrAdapter(provider?: PdfImportOcrProvider): OcrAdapter {
  return provider ? new PdfImportOcrAdapter(provider) : new UnavailableOcrAdapter();
}

class PdfImportOcrAdapter implements OcrAdapter {
  constructor(private readonly provider: PdfImportOcrProvider) {}

  async extractPages(input: OcrExtractionInput): Promise<OcrExtractionResult> {
    assertOcrScope(input);
    if (!input.fileName || !input.pdfBytes) return new UnavailableOcrAdapter().extractPages(input);

    const pages = await Promise.all(input.pages.map(async (page) => {
      try {
        const result = await this.provider.extractText({ fileName: input.fileName!, pageNumber: page.pageNumber, pdfBytes: input.pdfBytes! });
        const text = result.text.trim();
        return {
          pageNumber: page.pageNumber,
          coverage: text ? "PROCESSED" as const : "FAILED" as const,
          text,
          warnings: text ? [] : ["OCR provider returned empty text."],
          confidence: result.confidence,
        };
      } catch (error) {
        return {
          pageNumber: page.pageNumber,
          coverage: "FAILED" as const,
          text: "",
          warnings: [error instanceof Error ? error.message : "OCR request failed."],
          confidence: 0,
        };
      }
    }));
    const numericConfidence = pages.length > 0 ? pages.reduce((total, page) => total + page.confidence, 0) / pages.length : 0;
    return {
      method: "OCR_PROVIDER",
      confidence: confidenceLevel(numericConfidence),
      pages: pages.map((page) => ({
        pageNumber: page.pageNumber,
        coverage: page.coverage,
        text: page.text,
        warnings: page.warnings,
      })),
    };
  }
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

function confidenceLevel(value: number): ConfidenceLevel {
  if (value >= 0.8) return "HIGH";
  if (value >= 0.5) return "MEDIUM";
  return "LOW";
}
