import type { ReviewConfiguration } from "./types";

export type ReviewRunDocumentLimitInput = { id: string; fileSizeBytes?: number | null; mimeType?: string | null; pageCount?: number | null; sheetCount?: number | null };
export class ReviewRunLimitError extends Error { constructor(public readonly code: string, message: string) { super(`${code}: ${message}`); this.name = "ReviewRunLimitError"; } }

export function assertReviewRunLimits(configuration: Pick<ReviewConfiguration, "maxFiles" | "maxPdfPages" | "maxFileSizeMb" | "maxXlsxSheets">, documents: ReviewRunDocumentLimitInput[]): void {
  if (documents.length > configuration.maxFiles) throw new ReviewRunLimitError("REVIEW_LIMIT_MAX_FILES", `El run contiene ${documents.length} archivos; el máximo es ${configuration.maxFiles}.`);
  const totalBytes = documents.reduce((sum, document) => sum + (document.fileSizeBytes ?? 0), 0);
  if (totalBytes > configuration.maxFileSizeMb * 1024 * 1024) throw new ReviewRunLimitError("REVIEW_LIMIT_MAX_SIZE", `El tamaño agregado del run excede ${configuration.maxFileSizeMb} MB.`);
  const pdfPages = documents.filter((document) => document.mimeType === "application/pdf").reduce((sum, document) => sum + (document.pageCount ?? 0), 0);
  if (pdfPages > configuration.maxPdfPages) throw new ReviewRunLimitError("REVIEW_LIMIT_MAX_PDF_PAGES", `El run contiene ${pdfPages} páginas PDF; el máximo es ${configuration.maxPdfPages}.`);
  const xlsxSheets = documents.filter((document) => document.mimeType?.includes("spreadsheetml")).reduce((sum, document) => sum + (document.sheetCount ?? 0), 0);
  if (xlsxSheets > configuration.maxXlsxSheets) throw new ReviewRunLimitError("REVIEW_LIMIT_MAX_XLSX_SHEETS", `El run contiene ${xlsxSheets} hojas XLSX; el máximo es ${configuration.maxXlsxSheets}.`);
}
