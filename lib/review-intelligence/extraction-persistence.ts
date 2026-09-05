import { createHash } from "node:crypto";
import { ExtractionStatus } from "@prisma/client";
import { extractDocument, type ExtractionOutput } from "./extractors";
import type { ReviewDocumentFile } from "./documents";
import type { OcrAdapter } from "./ocr";

type PersistedVersion = { id: string; sha256: string };
type ExtractionClient = {
  reviewEvidence: { upsert(args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<unknown> };
  documentVersion: { update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown> };
};

export async function extractAndPersistDocumentVersion(input: { file: ReviewDocumentFile; version: PersistedVersion; companyId: string; projectId: string; ocrAdapter?: OcrAdapter }, client: ExtractionClient): Promise<ExtractionOutput> {
  try {
    const extracted = await extractDocument({ file: input.file, ocr: { adapter: input.ocrAdapter, companyId: input.companyId, projectId: input.projectId, documentVersionId: input.version.id } });
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
