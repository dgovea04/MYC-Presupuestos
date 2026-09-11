import { prisma } from "@/lib/db/prisma";
import { normalizeKnowledgeText, normalizeKnowledgeUnit } from "./normalization";
import { isKnowledgeFeatureEnabled } from "./feature-flags";
import { buildImportLearningIdempotencyKey, validateImportLearningBatch, type ImportLearningBatch, type ImportLearningConfidence, type ImportLearningObservation, type ImportLearningBatchResult } from "./import-learning-types";
import type { KnowledgeStatus } from "@prisma/client";
import { logKnowledgeOperation } from "./observability";

const rejectedStatuses = new Set(["REJECTED", "DEPRECATED"]);

export async function recordImportLearningBatch(batch: ImportLearningBatch): Promise<ImportLearningBatchResult | { status: "SKIPPED"; reason: "FEATURE_DISABLED" }> {
  validateImportLearningBatch(batch);
  if (!isKnowledgeFeatureEnabled("importLearningBridge", { companyId: batch.companyId, projectId: batch.projectId })) {
    return { status: "SKIPPED", reason: "FEATURE_DISABLED" };
  }

  const source = await prisma.knowledgeSource.upsert({
    where: { idempotencyKey: sourceIdempotencyKey(batch) },
    create: {
      idempotencyKey: sourceIdempotencyKey(batch),
      sourceType: batch.sourceType,
      label: batch.sourceLabel.trim(),
      privacy: "PRIVATE",
      companyId: batch.companyId,
      projectId: batch.projectId,
      createdById: batch.createdById,
      metadata: { importId: batch.importId, contractVersion: 1 },
    },
    update: {},
  });

  const result: ImportLearningBatchResult = { sourceId: source.id, observationIds: [], assertionIds: [], created: 0, skipped: [], conflicts: [] };
  for (const observation of batch.observations) {
    try {
      const evidence = await prisma.knowledgeEvidence.upsert({
        where: { idempotencyKey: evidenceIdempotencyKey(batch, observation) },
        create: createEvidenceData(batch, observation, source.id),
        update: {},
      });
      const resolution = await resolveCanonicalEntity(observation, batch.companyId);
      const state = classifyObservation(observation, resolution);
      if (state.kind === "SKIPPED") {
        result.skipped.push({ originalRecordId: observation.originalRecordId, domain: observation.domain, reason: state.reason });
        continue;
      }
      if (state.kind === "CONFLICT") {
        const assertionId = await upsertObservationAssertion(batch, observation, source.id, evidence.id, "REVIEW_REQUIRED", state.reason);
        result.assertionIds.push(assertionId);
        result.conflicts.push({ originalRecordId: observation.originalRecordId, domain: observation.domain, reason: state.reason });
        result.created += 1;
        continue;
      }

      if (observation.domain === "PRICE" && resolution.kind === "RESOURCE") {
        const row = await prisma.priceObservation.upsert({
          where: { idempotencyKey: buildImportLearningIdempotencyKey(batch.importId, observation.domain, observation.originalRecordId) },
          create: {
            idempotencyKey: buildImportLearningIdempotencyKey(batch.importId, observation.domain, observation.originalRecordId),
            resourceId: resolution.id,
            value: String(observation.value.value),
            currency: observation.currency ?? "PEN",
            unit: normalizeKnowledgeUnit(observation.unit ?? resolution.unit ?? ""),
            companyId: batch.companyId,
            projectId: batch.projectId,
            sourceId: source.id,
            evidenceId: evidence.id,
            observedAt: observation.observedAt ?? batch.observedAt ?? new Date(),
            scope: "PROJECT",
            status: "OBSERVED",
            confidence: observation.confidence,
          },
          update: { sourceId: source.id, evidenceId: evidence.id, confidence: observation.confidence },
        });
        result.observationIds.push(row.id);
        result.created += 1;
        continue;
      }
      if (observation.domain === "YIELD" && resolution.kind === "ITEM") {
        const row = await prisma.yieldObservation.upsert({
          where: { idempotencyKey: buildImportLearningIdempotencyKey(batch.importId, observation.domain, observation.originalRecordId) },
          create: {
            idempotencyKey: buildImportLearningIdempotencyKey(batch.importId, observation.domain, observation.originalRecordId),
            canonicalItemId: resolution.id,
            value: String(observation.value.value),
            unit: normalizeKnowledgeUnit(observation.unit ?? resolution.unit ?? ""),
            companyId: batch.companyId,
            projectId: batch.projectId,
            sourceId: source.id,
            evidenceId: evidence.id,
            observedAt: observation.observedAt ?? batch.observedAt ?? new Date(),
            scope: "PROJECT",
            status: "OBSERVED",
            confidence: observation.confidence,
          },
          update: { sourceId: source.id, evidenceId: evidence.id, confidence: observation.confidence },
        });
        result.observationIds.push(row.id);
        result.created += 1;
        continue;
      }

      const assertionStatus: KnowledgeStatus = resolution.kind === "NONE" ? "REVIEW_REQUIRED" : "OBSERVED";
      const assertionId = await upsertObservationAssertion(batch, observation, source.id, evidence.id, assertionStatus);
      result.assertionIds.push(assertionId);
      result.created += 1;
    } catch (error) {
      result.skipped.push({ originalRecordId: observation.originalRecordId, domain: observation.domain, reason: error instanceof Error ? error.message : "ROW_WRITE_FAILED" });
    }
  }

  logKnowledgeOperation({
    stage: "bridge",
    outcome: "success",
    correlationId: `import-learning:${batch.importId}`,
    companyId: batch.companyId,
    projectId: batch.projectId,
    idempotencyKey: `import-learning:${batch.importId}`,
    metadata: { sourceType: batch.sourceType, created: result.created, skipped: result.skipped.length, conflicts: result.conflicts.length },
  });
  return result;
}

function sourceIdempotencyKey(batch: ImportLearningBatch) {
  return `import-source:${batch.sourceType}:${batch.importId}`;
}

function evidenceIdempotencyKey(batch: ImportLearningBatch, observation: ImportLearningObservation) {
  return `import-evidence:${buildImportLearningIdempotencyKey(batch.importId, observation.domain, observation.originalRecordId)}`;
}

function createEvidenceData(batch: ImportLearningBatch, observation: ImportLearningObservation, sourceId: string) {
  const evidence = observation.evidence;
  return {
    idempotencyKey: evidenceIdempotencyKey(batch, observation),
    sourceId,
    fileName: evidence.fileName,
    page: evidence.page,
    sheet: evidence.sheet,
    cellRange: evidence.cellRange,
    quote: evidence.quote,
    checksum: evidence.checksum,
    companyId: batch.companyId,
    projectId: batch.projectId,
    createdById: batch.createdById,
    metadata: evidence.metadata,
  };
}

type CanonicalResolution =
  | { kind: "ITEM"; id: string; unit: string | null }
  | { kind: "RESOURCE"; id: string; unit: string | null }
  | { kind: "NONE"; reason: string }
  | { kind: "AMBIGUOUS"; reason: string };

async function resolveCanonicalEntity(observation: ImportLearningObservation, companyId: string): Promise<CanonicalResolution> {
  const candidate = observation.entity;
  if (!candidate || (candidate.domain !== "ITEM" && candidate.domain !== "RESOURCE")) return { kind: "NONE", reason: "CANONICAL_ENTITY_NOT_PROVIDED" };
  const normalizedName = normalizeKnowledgeText(candidate.name);
  if (!normalizedName) return { kind: "NONE", reason: "CANONICAL_ENTITY_NAME_MISSING" };
  const where = {
    OR: [
      { normalizedName },
      { aliases: { some: { normalizedAlias: normalizedName } } },
    ],
    NOT: { status: { in: [...rejectedStatuses] as KnowledgeStatus[] } },
  };
  const rows = candidate.domain === "ITEM"
    ? await prisma.canonicalItem.findMany({ where, select: { id: true, canonicalUnit: true, scope: true, companyId: true }, take: 10 })
    : await prisma.canonicalResource.findMany({ where, select: { id: true, canonicalUnit: true, scope: true, companyId: true }, take: 10 });
  const visible = rows.filter((row) => row.scope === "GLOBAL" || (row.scope === "COMPANY" && row.companyId === companyId));
  if (visible.length === 0) return { kind: "NONE", reason: "CANONICAL_ENTITY_NOT_FOUND" };
  if (visible.length > 1) return { kind: "AMBIGUOUS", reason: "MULTIPLE_CANONICAL_MATCHES" };
  const row = visible[0];
  return { kind: candidate.domain, id: row.id, unit: row.canonicalUnit };
}

function classifyObservation(observation: ImportLearningObservation, resolution: CanonicalResolution):
  | { kind: "ACCEPT" }
  | { kind: "CONFLICT"; reason: string }
  | { kind: "SKIPPED"; reason: string } {
  const evidence = observation.evidence;
  if (!evidence.fileName && !evidence.page && !evidence.sheet && !evidence.cellRange && !evidence.quote && !evidence.checksum && !evidence.metadata) return { kind: "CONFLICT", reason: "EVIDENCE_CONTENT_MISSING" };
  if (resolution.kind === "AMBIGUOUS") return { kind: "CONFLICT", reason: resolution.reason };
  if (resolution.kind === "NONE") return { kind: "CONFLICT", reason: resolution.reason };
  if (observation.domain === "PRICE" && resolution.kind !== "RESOURCE") return { kind: "CONFLICT", reason: "RESOURCE_MATCH_REQUIRED" };
  if (observation.domain === "YIELD" && resolution.kind !== "ITEM") return { kind: "CONFLICT", reason: "ITEM_MATCH_REQUIRED" };
  if ((observation.domain === "PRICE" || observation.domain === "YIELD") && (!observation.unit?.trim() || !resolution.unit?.trim())) return { kind: "CONFLICT", reason: "UNIT_REQUIRED_FOR_ACCEPTANCE" };
  if ((observation.domain === "PRICE" || observation.domain === "YIELD") && normalizeKnowledgeUnit(observation.unit!) !== normalizeKnowledgeUnit(resolution.unit!)) return { kind: "CONFLICT", reason: "INCOMPATIBLE_UNIT" };
  return { kind: "ACCEPT" };
}

async function upsertObservationAssertion(batch: ImportLearningBatch, observation: ImportLearningObservation, sourceId: string, evidenceId: string, status: KnowledgeStatus, reason?: string) {
  const idempotencyKey = buildImportLearningIdempotencyKey(batch.importId, observation.domain, observation.originalRecordId);
  const subjectId = `${batch.importId}:${observation.domain}:${observation.originalRecordId}`;
  const value = { ...observation.value, ...(observation.name ? { name: observation.name } : {}), ...(observation.unit ? { unit: normalizeKnowledgeUnit(observation.unit) } : {}), ...(reason ? { conflict: reason } : {}) };
  const row = await prisma.knowledgeAssertion.upsert({
    where: { idempotencyKey },
    create: {
      idempotencyKey,
      subjectType: `IMPORT_${observation.domain}`,
      subjectId,
      predicate: `import_${observation.domain.toLowerCase()}`,
      value,
      scope: "PROJECT",
      status,
      confidence: observation.confidence,
      companyId: batch.companyId,
      projectId: batch.projectId,
      sourceId,
      evidenceId,
      createdById: batch.createdById,
    },
    update: { sourceId, evidenceId, confidence: observation.confidence },
  });
  return row.id;
}

export function confidenceFromScore(score: number): ImportLearningConfidence {
  if (score >= 0.95) return "VERY_HIGH";
  if (score >= 0.8) return "HIGH";
  if (score >= 0.6) return "MEDIUM";
  if (score >= 0.3) return "LOW";
  return "VERY_LOW";
}
