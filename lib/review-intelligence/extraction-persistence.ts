import { createHash } from "node:crypto";
import { ExtractionStatus } from "@prisma/client";
import { extractDocument, type ExtractionOutput, type PdfPageCoverage } from "./extractors";
import type { ReviewDocumentFile } from "./documents";
import type { OcrAdapter } from "./ocr";

type PersistedVersion = { id: string; sha256: string };
type ExtractionClient = {
  reviewEvidence: { upsert(args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<unknown> };
  documentVersion: { update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown> };
};

type CoverageEntry = { page?: number; worksheet?: string; coverage?: string; method?: string; confidence?: string; warnings?: string[] };
type ReprocessableVersion = PersistedVersion & { extractionCoverage?: unknown; extractionWarnings?: unknown; mimeType?: string };

export async function reprocessDocumentCoverage(
  input: { file: ReviewDocumentFile; version: ReprocessableVersion; companyId: string; projectId: string; pages?: number[]; sheetNames?: string[]; ocrAdapter?: OcrAdapter },
  client: ExtractionClient,
): Promise<{ coverage: CoverageEntry[]; warnings: string[]; partial: boolean }> {
  if ((input.pages?.length ?? 0) + (input.sheetNames?.length ?? 0) === 0) throw new Error("Select at least one page or worksheet to reprocess.");
  const extracted = await extractDocument({ file: input.file, pdfPages: input.pages, xlsxSheetNames: input.sheetNames, ocr: { adapter: input.ocrAdapter, companyId: input.companyId, projectId: input.projectId, documentVersionId: input.version.id } });
  await persistEvidence(extracted, input.version, input.companyId, input.projectId, client);
  const coverage = mergeCoverage(coverageEntries(input.version.extractionCoverage), extracted.coverage ?? worksheetCoverage(extracted));
  const warnings = uniqueWarnings([...warningEntries(input.version.extractionWarnings), ...extracted.warnings]);
  await client.documentVersion.update({ where: { id: input.version.id, companyId: input.companyId, projectId: input.projectId }, data: { extractionStatus: warnings.length > 0 ? ExtractionStatus.COMPLETED_WITH_WARNINGS : ExtractionStatus.COMPLETED, extractionWarnings: warnings, extractionCoverage: coverage, extractionMethod: extracted.extractionMethod ?? (extracted.kind === "PDF" ? "PDF_TEXT" : "XLSX_CELL_RANGE"), extractionConfidence: extracted.extractionConfidence ?? "MEDIUM" } });
  return { coverage, warnings, partial: warnings.length > 0 };
}

export async function extractAndPersistDocumentVersion(input: { file: ReviewDocumentFile; version: PersistedVersion; companyId: string; projectId: string; ocrAdapter?: OcrAdapter }, client: ExtractionClient): Promise<ExtractionOutput> {
  try {
    const extracted = await extractDocument({ file: input.file, ocr: { adapter: input.ocrAdapter, companyId: input.companyId, projectId: input.projectId, documentVersionId: input.version.id } });
    await persistEvidence(extracted, input.version, input.companyId, input.projectId, client);
    const extractionMethod = extracted.extractionMethod ?? extracted.items.find((item) => item.extractionMethod)?.extractionMethod ?? (extracted.kind === "PDF" ? "PDF_TEXT" : "XLSX_CELL_RANGE");
    const extractionConfidence = extracted.extractionConfidence ?? extracted.items.find((item) => item.confidence)?.confidence ?? "MEDIUM";
    const extractedPdfPages = new Set<number>();
    if (extracted.kind === "PDF") {
      for (const item of extracted.items) {
        const page = item.location?.page;
        if (typeof page === "number" && Number.isInteger(page) && page > 0) extractedPdfPages.add(page);
      }
    }
    const extractionCoverage = extracted.coverage ?? (extracted.kind === "PDF"
      ? Array.from(extractedPdfPages).map((page) => ({ page, coverage: "PROCESSED" }))
      : Array.from(new Set(extracted.items.map((item) => item.location?.sheet).filter((sheet): sheet is string => Boolean(sheet)))).map((worksheet) => ({ worksheet, coverage: "PROCESSED" })));
    await client.documentVersion.update({ where: { id: input.version.id, companyId: input.companyId, projectId: input.projectId }, data: { extractionStatus: extracted.warnings.length > 0 ? ExtractionStatus.COMPLETED_WITH_WARNINGS : ExtractionStatus.COMPLETED, extractionWarnings: extracted.warnings, pageCount: extracted.pageCount, sheetCount: extracted.sheetCount, extractionMethod, extractionConfidence, extractionCoverage } });
    return extracted;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo extraer el documento.";
    await client.documentVersion.update({ where: { id: input.version.id, companyId: input.companyId, projectId: input.projectId }, data: { extractionStatus: ExtractionStatus.FAILED, extractionWarnings: [message] } });
    throw error;
  }
}

async function persistEvidence(extracted: ExtractionOutput, version: PersistedVersion, companyId: string, projectId: string, client: ExtractionClient): Promise<void> {
  for (const item of extracted.items) {
    const sourceHash = createHash("sha256").update(`${version.sha256}:${item.content}:${JSON.stringify(item.location ?? {})}`).digest("hex");
    const extractionMethod = item.extractionMethod ?? (extracted.kind === "PDF" ? "PDF_TEXT" : "XLSX_CELL_RANGE");
    const confidence = item.confidence ?? "MEDIUM";
    await client.reviewEvidence.upsert({ where: { documentVersionId_sourceHash: { documentVersionId: version.id, sourceHash } }, create: { companyId, projectId, documentVersionId: version.id, evidenceType: item.metadata?.evidenceType ?? "OTHER", originalText: item.content, normalizedText: item.content, locationJson: item.location ?? {}, metadataJson: { ...(item.metadata ?? {}), primary: item.primary !== false, extractionMethod }, extractionMethod, confidence, sourceHash }, update: { normalizedText: item.content, locationJson: item.location ?? {}, metadataJson: { ...(item.metadata ?? {}), primary: item.primary !== false, extractionMethod }, extractionMethod, confidence } });
  }
}

function coverageEntries(value: unknown): CoverageEntry[] { return Array.isArray(value) ? value.flatMap((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry) ? [entry as CoverageEntry] : []) : []; }
function warningEntries(value: unknown): string[] { return Array.isArray(value) ? value.filter((warning): warning is string => typeof warning === "string") : []; }
function uniqueWarnings(warnings: string[]): string[] { return [...new Set(warnings)]; }
function worksheetCoverage(extracted: ExtractionOutput): CoverageEntry[] { return extracted.kind === "XLSX" ? [...new Set(extracted.items.map((item) => item.location?.sheet).filter((sheet): sheet is string => typeof sheet === "string"))].map((worksheet) => ({ worksheet, coverage: "PROCESSED" })) : []; }
function mergeCoverage(existing: CoverageEntry[], updated: Array<CoverageEntry | PdfPageCoverage>): CoverageEntry[] { const merged = new Map<string, CoverageEntry>(); for (const entry of [...existing, ...updated]) { const worksheet = "worksheet" in entry ? entry.worksheet : undefined; const key = typeof entry.page === "number" ? `page:${entry.page}` : typeof worksheet === "string" ? `worksheet:${worksheet}` : ""; if (key) merged.set(key, { ...entry, ...(worksheet ? { worksheet } : {}) }); } return [...merged.values()]; }
