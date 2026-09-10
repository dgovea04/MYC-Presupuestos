import { prisma } from "@/lib/db/prisma";
import { assertKnowledgeApiScopeAccess, assertKnowledgeEntityAccess } from "./api-access";
import type { Prisma } from "@prisma/client";
import { logKnowledgeOperation } from "./observability";

export interface KnowledgeSourceInput { sourceType: string; label: string; privacy?: "PRIVATE" | "AGGREGATABLE" | "PUBLIC"; metadata?: Record<string, unknown>; actorUserId: string; companyId: string; projectId?: string; idempotencyKey?: string; }
export interface KnowledgeEvidenceInput { sourceId: string; documentId?: string; fileName?: string; page?: string; sheet?: string; cellRange?: string; url?: string; quote?: string; checksum?: string; metadata?: Record<string, unknown>; actorUserId: string; companyId: string; projectId?: string; idempotencyKey?: string; }

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function validateProvenance(input: { sourceId?: string; evidenceId?: string }): void {
  if (!input.sourceId) throw new Error("sourceId is required for provenance");
}

export async function createKnowledgeSource(input: KnowledgeSourceInput) {
  if (!input.sourceType.trim() || !input.label.trim()) throw new Error("sourceType and label are required");
  await assertKnowledgeApiScopeAccess({ actorUserId: input.actorUserId, scope: input.projectId ? "PROJECT" : "COMPANY", companyId: input.companyId, projectId: input.projectId });
  const data = { sourceType: input.sourceType.trim(), label: input.label.trim(), privacy: input.privacy ?? "PRIVATE", companyId: input.companyId, projectId: input.projectId, createdById: input.actorUserId, metadata: toJson(input.metadata), idempotencyKey: input.idempotencyKey };
  if (!input.idempotencyKey) return prisma.knowledgeSource.create({ data });
  return prisma.knowledgeSource.upsert({ where: { idempotencyKey: input.idempotencyKey }, create: data, update: { metadata: data.metadata, label: data.label } });
}

export async function createKnowledgeEvidence(input: KnowledgeEvidenceInput) {
  if (!input.sourceId) throw new Error("sourceId is required for evidence");
  if (!input.fileName && !input.url && !input.quote) throw new Error("Evidence needs a file, URL or quote");
  await assertKnowledgeEntityAccess({ actorUserId: input.actorUserId, entityType: "KnowledgeSource", entityId: input.sourceId, companyId: input.companyId, projectId: input.projectId });
  const data = { sourceId: input.sourceId, documentId: input.documentId, fileName: input.fileName, page: input.page, sheet: input.sheet, cellRange: input.cellRange, url: input.url, quote: input.quote, checksum: input.checksum, companyId: input.companyId, projectId: input.projectId, createdById: input.actorUserId, metadata: toJson(input.metadata), idempotencyKey: input.idempotencyKey };
  const result = !input.idempotencyKey ? await prisma.knowledgeEvidence.create({ data }) : await prisma.knowledgeEvidence.upsert({ where: { idempotencyKey: input.idempotencyKey }, create: data, update: { sourceId: data.sourceId, documentId: data.documentId, fileName: data.fileName, page: data.page, sheet: data.sheet, cellRange: data.cellRange, url: data.url, quote: data.quote, checksum: data.checksum, metadata: data.metadata } });
  logKnowledgeOperation({ stage: "provenance", outcome: "success", correlationId: input.idempotencyKey ?? `provenance:${result.id}`, companyId: input.companyId, projectId: input.projectId, idempotencyKey: input.idempotencyKey, metadata: { evidenceId: result.id, sourceId: input.sourceId } });
  return result;
}
