import { createHash } from "node:crypto";
import { ExtractionStatus } from "@prisma/client";
import { extractDocument, type ExtractionCoverageRecord, type ExtractionOutput } from "./extractors";
import type { ReviewDocumentFile } from "./documents";
import type { OcrAdapter } from "./ocr";

type PersistedVersion = { id: string; sha256: string };
type ExtractionClient = {
  reviewEvidence: { upsert(args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<unknown> };
  documentVersion: { update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>; findFirst?: (args: { where: Record<string, unknown>; select?: Record<string, unknown> }) => Promise<Record<string, unknown> | null> };
};

export async function extractAndPersistDocumentVersion(input: { file: ReviewDocumentFile; version: PersistedVersion; companyId: string; projectId: string; ocrAdapter?: OcrAdapter; selectedPageNumbers?: number[]; xlsxSheetNames?: string[] }, client: ExtractionClient): Promise<ExtractionOutput> {
  try {
    const extracted = await extractDocument({ file: input.file, selectedPageNumbers: input.selectedPageNumbers, xlsxSheetNames: input.xlsxSheetNames, ocr: { adapter: input.ocrAdapter, companyId: input.companyId, projectId: input.projectId, documentVersionId: input.version.id } });
    await persistExtraction(input, extracted, client);
    return extracted;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo extraer el documento.";
    await client.documentVersion.update({ where: { id: input.version.id, companyId: input.companyId, projectId: input.projectId }, data: { extractionStatus: ExtractionStatus.FAILED, extractionWarnings: [message] } });
    throw error;
  }
}

export async function reprocessDocumentCoverage(input: { file: ReviewDocumentFile; documentVersionId: string; companyId: string; projectId: string; pages?: number[]; worksheets?: string[]; ocrAdapter?: OcrAdapter }, client: ExtractionClient): Promise<ExtractionOutput & { coverage: ExtractionCoverageRecord[] }> {
  if (!client.documentVersion.findFirst) throw new Error("Reprocessing requires a document version reader.");
  const version = await client.documentVersion.findFirst({ where: { id: input.documentVersionId, companyId: input.companyId, projectId: input.projectId }, select: { id: true, sha256: true, extractionCoverage: true } });
  if (!version) throw new Error("Document version not found.");
  const existingCoverage = parseCoverage(version.extractionCoverage);
  const requestedPages = normalizePositiveSelection(input.pages, "pages");
  const requestedWorksheets = normalizeStringSelection(input.worksheets, "worksheets");
  validateSelection(existingCoverage, requestedPages, requestedWorksheets);
  const extracted = await extractDocument({ file: input.file, selectedPageNumbers: requestedPages, xlsxSheetNames: requestedWorksheets, ocr: { adapter: input.ocrAdapter, companyId: input.companyId, projectId: input.projectId, documentVersionId: input.documentVersionId } });
  const mergedCoverage = mergeCoverage(existingCoverage, extracted.coverage ?? []);
  await persistExtraction({ ...input, version: { id: input.documentVersionId, sha256: String(version.sha256) } }, { ...extracted, coverage: mergedCoverage }, client);
  return { ...extracted, coverage: mergedCoverage };
}

async function persistExtraction(input: { version: PersistedVersion; companyId: string; projectId: string }, extracted: ExtractionOutput, client: ExtractionClient): Promise<void> {
    for (const item of extracted.items) {
      const sourceHash = createHash("sha256").update(`${input.version.sha256}:${item.content}:${JSON.stringify(item.location ?? {})}`).digest("hex");
      const extractionMethod = item.extractionMethod ?? (extracted.kind === "PDF" ? "PDF_TEXT" : "XLSX_CELL_RANGE");
      const confidence = item.confidence ?? "MEDIUM";
      await client.reviewEvidence.upsert({
        where: { documentVersionId_sourceHash: { documentVersionId: input.version.id, sourceHash } },
        create: { companyId: input.companyId, projectId: input.projectId, documentVersionId: input.version.id, evidenceType: item.metadata?.evidenceType ?? "OTHER", originalText: item.content, normalizedText: item.content, locationJson: item.location ?? {}, metadataJson: { ...(item.metadata ?? {}), primary: item.primary !== false, extractionMethod }, extractionMethod, confidence, sourceHash },
        update: { normalizedText: item.content, locationJson: item.location ?? {}, metadataJson: { ...(item.metadata ?? {}), primary: item.primary !== false, extractionMethod }, extractionMethod, confidence },
      });
    }
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
      ? Array.from(extractedPdfPages).map((page) => ({ page, coverage: "PROCESSED" as const }))
      : Array.from(new Set(extracted.items.map((item) => item.location?.sheet).filter((sheet): sheet is string => Boolean(sheet)))).map((worksheet) => ({ worksheet, coverage: "PROCESSED" as const })));
    await client.documentVersion.update({ where: { id: input.version.id, companyId: input.companyId, projectId: input.projectId }, data: { extractionStatus: extracted.warnings.length > 0 ? ExtractionStatus.COMPLETED_WITH_WARNINGS : ExtractionStatus.COMPLETED, extractionWarnings: extracted.warnings, pageCount: extracted.pageCount, sheetCount: extracted.sheetCount, extractionMethod, extractionConfidence, extractionCoverage } });
}

function parseCoverage(value: unknown): ExtractionCoverageRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const row = entry as Record<string, unknown>;
    if ((typeof row.page !== "number" && typeof row.worksheet !== "string") || typeof row.coverage !== "string") return [];
    return [{ ...(typeof row.page === "number" ? { page: row.page } : { worksheet: row.worksheet as string }), coverage: row.coverage as "PROCESSED" | "OCR_REQUIRED" | "FAILED", ...(typeof row.method === "string" ? { method: row.method as ExtractionCoverageRecord["method"] } : {}), ...(typeof row.confidence === "string" ? { confidence: row.confidence as ExtractionCoverageRecord["confidence"] } : {}), ...(Array.isArray(row.warnings) ? { warnings: row.warnings.filter((warning): warning is string => typeof warning === "string") } : {}) }];
  });
}

function normalizePositiveSelection(value: number[] | undefined, field: string): number[] | undefined {
  if (value === undefined) return undefined;
  if (value.length === 0 || value.some((entry) => !Number.isInteger(entry) || entry < 1)) throw new Error(`${field} must contain positive whole numbers.`);
  return [...new Set(value)].sort((left, right) => left - right);
}

function normalizeStringSelection(value: string[] | undefined, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (value.length === 0 || value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) throw new Error(`${field} must contain non-empty names.`);
  return [...new Set(value.map((entry) => entry.trim()))].sort();
}

function validateSelection(existing: ExtractionCoverageRecord[], pages: number[] | undefined, worksheets: string[] | undefined): void {
  if (pages && existing.length > 0 && pages.some((page) => !existing.some((entry) => entry.page === page))) throw new Error("Requested page is outside the document coverage.");
  if (worksheets && existing.length > 0 && worksheets.some((sheet) => !existing.some((entry) => (entry as { worksheet?: string }).worksheet === sheet))) throw new Error("Requested worksheet is outside the document coverage.");
}

function mergeCoverage(existing: ExtractionCoverageRecord[], incoming: ExtractionCoverageRecord[]): ExtractionCoverageRecord[] {
  const key = (entry: ExtractionCoverageRecord) => entry.page !== undefined ? `page:${entry.page}` : `worksheet:${entry.worksheet}`;
  const merged = new Map(existing.map((entry) => [key(entry), entry]));
  incoming.forEach((entry) => merged.set(key(entry), entry));
  return [...merged.values()].sort((left, right) => (left.page ?? Number.MAX_SAFE_INTEGER) - (right.page ?? Number.MAX_SAFE_INTEGER) || (left.worksheet ?? "").localeCompare(right.worksheet ?? ""));
}
