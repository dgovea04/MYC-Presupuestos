import { classifyPdfImportPage, isLikelyScannedPdfPage } from "./page-classifier";
import type { PdfImportOcrProvider } from "./ocr";
import type { PdfImportDocumentRole } from "./types";

export type PdfImportExtractedFile = {
  id: string;
  fileName: string;
  role: PdfImportDocumentRole;
  text: string;
  pageCount: number;
  requiresOcr: boolean;
  ocrApplied: boolean;
  confidence: number;
};

export type PdfImportExtractionOptions = {
  ocrProvider?: PdfImportOcrProvider;
};

export async function extractPdfImportFile(
  file: File,
  role: PdfImportDocumentRole = "AUTO",
  options: PdfImportExtractionOptions = {},
): Promise<PdfImportExtractedFile> {
  const embeddedText = await file.text();
  const requiresOcr = isLikelyScannedPdfPage(embeddedText);
  const ocrResult = requiresOcr && options.ocrProvider
    ? await options.ocrProvider.extractText({
        fileName: file.name,
        pageNumber: 1,
        pdfBytes: new Uint8Array(await file.arrayBuffer()),
      })
    : null;
  const text = ocrResult?.text ?? embeddedText;
  const inferredRole = role === "AUTO" ? classifyPdfImportPage(text) : role;

  return {
    id: createFileId(file.name),
    fileName: file.name,
    role: inferredRole,
    text,
    pageCount: estimatePageCount(text),
    requiresOcr,
    ocrApplied: ocrResult != null,
    confidence: ocrResult?.confidence ?? (requiresOcr ? 0.2 : 0.75),
  };
}

function createFileId(fileName: string) {
  return `file-${fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pdf"}`;
}

function estimatePageCount(text: string) {
  const explicitPages = text.match(/\f/g)?.length;
  if (explicitPages && explicitPages > 0) {
    return explicitPages + 1;
  }
  return 1;
}
