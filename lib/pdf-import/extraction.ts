import { classifyPdfImportPage, isLikelyScannedPdfPage } from "./page-classifier";
import { extractDigitalPdf } from "./digital-extraction";
import type { PdfImportOcrProvider } from "./ocr";
import { countPdfPages } from "./pdf-page-count";
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
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digitalExtraction = await extractDigitalPdf(bytes);
  const embeddedText = digitalExtraction.pages
    .filter((page) => page.text.length > 0)
    .map((page) => `Pagina ${page.page}:\n${page.text}`)
    .join("\n\n");
  const requiresOcr = isLikelyScannedPdfPage(embeddedText);
  const ocrResult = requiresOcr && options.ocrProvider ? await extractWithOcr(options.ocrProvider, file.name, bytes, digitalExtraction.pageCount) : null;
  const text = ocrResult?.text ?? embeddedText;
  const inferredRole = role === "AUTO" ? classifyPdfImportPage(text) : role;

  return {
    id: createFileId(file.name),
    fileName: file.name,
    role: inferredRole,
    text,
    pageCount: countPdfPages(bytes),
    requiresOcr,
    ocrApplied: ocrResult != null,
    confidence: ocrResult?.confidence ?? (requiresOcr ? 0.2 : 0.75),
  };
}

async function extractWithOcr(provider: PdfImportOcrProvider, fileName: string, pdfBytes: Uint8Array, pageCount: number) {
  const results: Array<{ text: string; confidence: number }> = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    results.push(await provider.extractText({ fileName, pageNumber, pdfBytes }));
  }

  return {
    text: results.map((result, index) => `Pagina ${index + 1}:\n${result.text}`).join("\n\n"),
    confidence: results.reduce((sum, result) => sum + result.confidence, 0) / Math.max(1, results.length),
  };
}

function createFileId(fileName: string) {
  return `file-${fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pdf"}`;
}
