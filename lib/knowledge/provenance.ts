import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export interface KnowledgeSourceInput { sourceType: string; label: string; privacy?: "PRIVATE" | "AGGREGATABLE" | "PUBLIC"; metadata?: Record<string, unknown>; }
export interface KnowledgeEvidenceInput { sourceId: string; documentId?: string; fileName?: string; page?: string; sheet?: string; cellRange?: string; url?: string; quote?: string; checksum?: string; metadata?: Record<string, unknown>; }

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function validateProvenance(input: { sourceId?: string; evidenceId?: string }): void {
  if (!input.sourceId) throw new Error("sourceId is required for provenance");
}

export async function createKnowledgeSource(input: KnowledgeSourceInput) {
  if (!input.sourceType.trim() || !input.label.trim()) throw new Error("sourceType and label are required");
  return prisma.knowledgeSource.create({ data: { sourceType: input.sourceType.trim(), label: input.label.trim(), privacy: input.privacy ?? "PRIVATE", metadata: toJson(input.metadata) } });
}

export async function createKnowledgeEvidence(input: KnowledgeEvidenceInput) {
  if (!input.sourceId) throw new Error("sourceId is required for evidence");
  if (!input.fileName && !input.url && !input.quote) throw new Error("Evidence needs a file, URL or quote");
  return prisma.knowledgeEvidence.create({ data: { sourceId: input.sourceId, documentId: input.documentId, fileName: input.fileName, page: input.page, sheet: input.sheet, cellRange: input.cellRange, url: input.url, quote: input.quote, checksum: input.checksum, metadata: toJson(input.metadata) } });
}
