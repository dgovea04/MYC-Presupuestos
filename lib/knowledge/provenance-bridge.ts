import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership, assertProjectInWorkspace } from "@/lib/workspace/access";
import { buildMigrationEvidenceKey } from "./backfill";
import { createKnowledgeEvidence, createKnowledgeSource } from "./provenance";
import type { KnowledgeEvidenceInput } from "./provenance";

export interface ReviewEvidenceKnowledgeLinkInput {
  actorUserId: string;
  companyId: string;
  projectId: string;
  reviewEvidenceId: string;
  knowledgeEvidenceId: string;
  relationType: "DERIVED_FROM" | "CONFIRMS" | "CONTEXT_FOR";
}

type ReviewEvidenceSnapshot = {
  id: string;
  companyId: string;
  projectId: string;
  documentVersionId: string;
  evidenceType: string;
  originalText: string;
  normalizedText: string | null;
  locationJson: unknown;
  value: unknown;
  unit: string | null;
  extractionMethod: string;
  confidence: string;
  sourceHash: string;
  metadataJson: unknown;
  documentVersion: {
    projectDocumentId: string;
    versionNumber: number;
    originalFileName: string;
    projectDocument: { name: string };
  };
};

type MigrationProvenanceInput = {
  sourceKey: string;
  domain: "item" | "resource" | "price" | "apu";
  sourceRecordId: string;
  companyId: string;
  projectId?: string;
  correlationId: string;
  dryRun?: boolean;
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function linkMigrationKnowledgeEntity(input: { domain: "item" | "resource"; entityId: string; sourceId: string; evidenceId: string; idempotencyKey: string }) {
  if (input.domain === "item") {
    return prisma.knowledgeCanonicalItemProvenance.upsert({ where: { idempotencyKey: input.idempotencyKey }, create: { canonicalItemId: input.entityId, sourceId: input.sourceId, evidenceId: input.evidenceId, idempotencyKey: input.idempotencyKey }, update: {} });
  }
  return prisma.knowledgeCanonicalResourceProvenance.upsert({ where: { idempotencyKey: input.idempotencyKey }, create: { canonicalResourceId: input.entityId, sourceId: input.sourceId, evidenceId: input.evidenceId, idempotencyKey: input.idempotencyKey }, update: {} });
}

export async function createMigrationKnowledgeProvenance(input: MigrationProvenanceInput) {
  if (input.dryRun) return { source: undefined, evidence: undefined, sourceOutcome: "skipped" as const, evidenceOutcome: "skipped" as const };

  let source;
  let sourceOutcome: "created" | "skipped";
  try {
    source = await prisma.knowledgeSource.create({ data: {
      idempotencyKey: input.sourceKey,
      sourceType: "MIGRATION",
      label: "Knowledge backfill",
      privacy: "PRIVATE",
      companyId: input.companyId,
      projectId: input.projectId,
      createdById: "migration",
      metadata: { actor: "migration", script: "scripts/backfill-knowledge.ts", correlationId: input.correlationId },
    } });
    sourceOutcome = "created";
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    source = await prisma.knowledgeSource.findUnique({ where: { idempotencyKey: input.sourceKey } });
    if (!source) throw new Error("Migration source disappeared after unique conflict");
    sourceOutcome = "skipped";
  }
  const evidenceKey = buildMigrationEvidenceKey({ sourceKey: input.sourceKey, domain: input.domain, sourceRecordId: input.sourceRecordId });
  let evidence;
  let evidenceOutcome: "created" | "skipped";
  try {
    evidence = await prisma.knowledgeEvidence.create({ data: {
      idempotencyKey: evidenceKey,
      sourceId: source.id,
      quote: `Migrated ${input.domain} record ${input.sourceRecordId}`,
      companyId: input.companyId,
      projectId: input.projectId,
      createdById: "migration",
      metadata: { actor: "migration", script: "scripts/backfill-knowledge.ts", correlationId: input.correlationId, domain: input.domain, sourceRecordId: input.sourceRecordId },
    } });
    evidenceOutcome = "created";
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    evidence = await prisma.knowledgeEvidence.findUnique({ where: { idempotencyKey: evidenceKey } });
    if (!evidence) throw new Error("Migration evidence disappeared after unique conflict");
    evidenceOutcome = "skipped";
  }
  return { source, evidence, sourceOutcome, evidenceOutcome };
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function mapReviewEvidenceToKnowledgeEvidence(row: ReviewEvidenceSnapshot): Omit<KnowledgeEvidenceInput, "sourceId" | "actorUserId" | "companyId" | "projectId"> {
  const location = jsonRecord(row.locationJson);
  const metadata = jsonRecord(row.metadataJson);
  const page = typeof location.page === "number" && Number.isInteger(location.page) && location.page > 0 ? String(location.page) : optionalString(location.page);
  const sheet = optionalString(location.sheet);
  const cellRange = optionalString(location.range) ?? optionalString(location.cellRange);
  const value = row.value === null || row.value === undefined ? undefined : String(row.value);
  return {
    idempotencyKey: `review-evidence:${row.id}`,
    documentId: row.documentVersion.projectDocumentId,
    fileName: row.documentVersion.originalFileName,
    page,
    sheet,
    cellRange,
    quote: row.originalText,
    checksum: row.sourceHash,
    metadata: {
      ...metadata,
      reviewEvidenceId: row.id,
      documentVersionId: row.documentVersionId,
      documentVersion: row.documentVersion.versionNumber,
      documentName: row.documentVersion.projectDocument.name,
      evidenceType: row.evidenceType,
      normalizedText: row.normalizedText,
      value,
      unit: row.unit,
      extractionMethod: row.extractionMethod,
      confidence: row.confidence,
      location: row.locationJson,
    },
  };
}

export async function createKnowledgeEvidenceFromReview(input: { reviewEvidenceId: string; actorUserId: string; companyId: string; projectId: string }) {
  await assertWorkspaceMembership({ userId: input.actorUserId, companyId: input.companyId, minimumRole: "EDITOR" });
  await assertProjectInWorkspace({ companyId: input.companyId, projectId: input.projectId });
  const reviewEvidence = await prisma.reviewEvidence.findFirst({
    where: { id: input.reviewEvidenceId, companyId: input.companyId, projectId: input.projectId },
    select: {
      id: true, companyId: true, projectId: true, documentVersionId: true, evidenceType: true, originalText: true,
      normalizedText: true, locationJson: true, value: true, unit: true, extractionMethod: true, confidence: true,
      sourceHash: true, metadataJson: true,
      documentVersion: { select: { projectDocumentId: true, versionNumber: true, originalFileName: true, projectDocument: { select: { name: true } } } },
    },
  });
  if (!reviewEvidence) throw new Error("Review evidence not found in requested project");
  const row = reviewEvidence as ReviewEvidenceSnapshot;
  const mapped = mapReviewEvidenceToKnowledgeEvidence(row);
  const source = await createKnowledgeSource({
    sourceType: "MC_REVISOR",
    label: `MC Revisión Inteligente · ${row.documentVersion.projectDocument.name}`,
    privacy: "PRIVATE",
    actorUserId: input.actorUserId,
    companyId: input.companyId,
    projectId: input.projectId,
    idempotencyKey: `review-source:${input.companyId}:${input.projectId}`,
    metadata: { reviewEvidenceId: row.id, documentVersionId: row.documentVersionId, documentId: row.documentVersion.projectDocumentId },
  });
  const evidence = await createKnowledgeEvidence({ ...mapped, sourceId: source.id, actorUserId: input.actorUserId, companyId: input.companyId, projectId: input.projectId });
  const link = await linkReviewEvidenceToKnowledge({ actorUserId: input.actorUserId, companyId: input.companyId, projectId: input.projectId, reviewEvidenceId: row.id, knowledgeEvidenceId: evidence.id, relationType: "DERIVED_FROM" });
  return { source, evidence, link };
}

export async function linkReviewEvidenceToKnowledge(input: ReviewEvidenceKnowledgeLinkInput) {
  await assertWorkspaceMembership({ userId: input.actorUserId, companyId: input.companyId, minimumRole: "EDITOR" });
  await assertProjectInWorkspace({ companyId: input.companyId, projectId: input.projectId });
  const [reviewEvidence, knowledgeEvidence] = await Promise.all([
    prisma.reviewEvidence.findUnique({ where: { id: input.reviewEvidenceId }, select: { id: true, companyId: true, projectId: true, documentVersionId: true } }),
    prisma.knowledgeEvidence.findUnique({ where: { id: input.knowledgeEvidenceId }, select: { id: true, companyId: true, projectId: true } }),
  ]);
  if (!reviewEvidence || !knowledgeEvidence || reviewEvidence.companyId !== input.companyId || reviewEvidence.projectId !== input.projectId || knowledgeEvidence.companyId !== input.companyId || knowledgeEvidence.projectId !== input.projectId) throw new Error("Knowledge tenant access denied");
  return prisma.knowledgeReviewEvidenceLink.upsert({
    where: { reviewEvidenceId_knowledgeEvidenceId: { reviewEvidenceId: input.reviewEvidenceId, knowledgeEvidenceId: input.knowledgeEvidenceId } },
    create: { reviewEvidenceId: input.reviewEvidenceId, knowledgeEvidenceId: input.knowledgeEvidenceId, companyId: input.companyId, projectId: input.projectId, relationType: input.relationType, createdById: input.actorUserId },
    update: { relationType: input.relationType },
  });
}
