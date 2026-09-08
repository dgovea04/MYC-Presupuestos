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
  aiDebug?: NonNullable<Awaited<ReturnType<PdfImportOcrProvider["extractText"]>>["debug"]>[];
};

export type PdfImportExtractionOptions = {
  ocrProvider?: PdfImportOcrProvider;
  onProgress?: (event: PdfImportExtractionProgress) => void;
};

export type PdfImportExtractionProgress = {
  phase: "ocr";
  status: "started" | "completed";
  pageNumber: number;
  totalPages: number;
  fileName: string;
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
  const ocrResult = requiresOcr && options.ocrProvider
    ? await extractWithOcr(options.ocrProvider, file.name, bytes, digitalExtraction.pageCount, options.onProgress)
    : null;
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
    aiDebug: ocrResult?.debug,
  };
}

async function extractWithOcr(
  provider: PdfImportOcrProvider,
  fileName: string,
  pdfBytes: Uint8Array,
  pageCount: number,
  onProgress?: PdfImportExtractionOptions["onProgress"],
) {
  onProgress?.({ phase: "ocr", status: "started", pageNumber: 1, totalPages: pageCount, fileName });
  const result = await provider.extractText({ fileName, pdfBytes });
  onProgress?.({ phase: "ocr", status: "completed", pageNumber: pageCount, totalPages: pageCount, fileName });

  return {
    text: result.text,
    confidence: result.confidence,
    debug: result.debug ? [result.debug] : [],
  };
}

function createFileId(fileName: string) {
  return `file-${fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pdf"}`;
}
