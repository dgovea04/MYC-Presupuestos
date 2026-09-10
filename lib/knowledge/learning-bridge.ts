import { recordReviewDecisionKnowledgeEvent } from "./integrations";
import { createPriceObservation, createYieldObservation } from "./observations";
import { buildReviewObservations } from "./observations-from-review";
import { createKnowledgeIntegrationJob } from "./integration-jobs";
import type { PriceObservationInput, YieldObservationInput } from "./observations";
import { persistReviewApuCorrection } from "./apu";
import { prisma } from "@/lib/db/prisma";
import { resolvePersistedReviewCanonicalEntities } from "./review-canonical-resolution";
import { isKnowledgeFeatureEnabled } from "./feature-flags";
import { logKnowledgeOperation } from "./observability";

export type BridgeInput = Parameters<typeof buildReviewObservations>[0] & { actorUserId: string; correlationId: string };
type BridgeResult = { status: "PROCESSED" | "SKIPPED" | "RETRYABLE_FAILURE"; eventId?: string; observationIds: string[]; apuVersionIds: string[]; skipReasons: string[] };

export async function processReviewLearning(input: BridgeInput, options: { recordEvent?: boolean } = {}): Promise<BridgeResult> {
  if (!isKnowledgeFeatureEnabled("reviewLearningBridge")) {
    logKnowledgeOperation({ stage: "bridge", outcome: "skip", correlationId: input.correlationId, companyId: input.companyId, projectId: input.projectId, findingId: input.findingId, decisionId: input.decisionId, metadata: { reason: "FEATURE_DISABLED" } });
    return { status: "SKIPPED", observationIds: [], apuVersionIds: [], skipReasons: ["FEATURE_DISABLED"] };
  }
  const event = options.recordEvent === false ? undefined : await recordReviewDecisionKnowledgeEvent({ userId: input.actorUserId, companyId: input.companyId, projectId: input.projectId, findingId: input.findingId, decisionId: input.decisionId, resolution: input.resolution, correlationId: input.correlationId, evidenceId: input.evidenceId });
  const built = buildReviewObservations(input);
  if (built.observations.length === 0 && built.apuCorrections.length === 0) { logKnowledgeOperation({ stage: "bridge", outcome: "skip", correlationId: input.correlationId, companyId: input.companyId, projectId: input.projectId, findingId: input.findingId, decisionId: input.decisionId, metadata: { reasons: built.skipReasons } }); return { status: "SKIPPED", eventId: event?.event.id, observationIds: [], apuVersionIds: [], skipReasons: built.skipReasons }; }
  const observationIds: string[] = [];
  const apuVersionIds: string[] = [];
  try {
    for (const observation of built.observations) {
      const result = "canonicalItemId" in observation ? await createYieldObservation(observation as YieldObservationInput) : await createPriceObservation(observation as PriceObservationInput);
      observationIds.push(result.id);
    }
    for (const correction of built.apuCorrections) {
      const result = await persistReviewApuCorrection({ ...correction, scope: "PROJECT", companyId: input.companyId, projectId: input.projectId, actorUserId: input.actorUserId });
      apuVersionIds.push(result.id);
    }
    logKnowledgeOperation({ stage: "bridge", outcome: "success", correlationId: input.correlationId, companyId: input.companyId, projectId: input.projectId, findingId: input.findingId, decisionId: input.decisionId, metadata: { observationCount: observationIds.length, apuVersionCount: apuVersionIds.length, eventCreated: event?.created ?? false } });
    return { status: "PROCESSED", eventId: event?.event.id, observationIds, apuVersionIds, skipReasons: [] };
  } catch (error) {
    logKnowledgeOperation({ stage: "bridge", outcome: "retry", correlationId: input.correlationId, companyId: input.companyId, projectId: input.projectId, findingId: input.findingId, decisionId: input.decisionId, errorCode: "KNOWLEDGE_WRITE_FAILED", metadata: { message: error instanceof Error ? error.message : "unknown" } });
    await createKnowledgeIntegrationJob({ idempotencyKey: `review-learning:${input.decisionId}`, companyId: input.companyId, projectId: input.projectId, findingId: input.findingId, decisionId: input.decisionId, actorUserId: input.actorUserId });
    return { status: "RETRYABLE_FAILURE", eventId: event?.event.id, observationIds, apuVersionIds, skipReasons: ["KNOWLEDGE_WRITE_FAILED"] };
  }
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readApuSnapshot(value: unknown, companyId: string, projectId: string): BridgeInput["apuBefore"] {
  const row = jsonRecord(value);
  const apuId = stringValue(row.apuId);
  const name = stringValue(row.name);
  const unit = stringValue(row.unit);
  const performance = stringValue(row.performance);
  if (!apuId || !name || !unit || !performance || !Array.isArray(row.resources)) return undefined;
  const resources = row.resources.map((resource) => {
    const entry = jsonRecord(resource);
    const description = stringValue(entry.description);
    const resourceUnit = stringValue(entry.unit);
    const quantity = stringValue(entry.quantity);
    const unitPrice = stringValue(entry.unitPrice);
    const resourceType = stringValue(entry.resourceType);
    const sortOrder = entry.sortOrder;
    if (!description || !resourceUnit || !quantity || !unitPrice || !resourceType || typeof sortOrder !== "number" || !Number.isInteger(sortOrder)) return undefined;
    return { resourceId: stringValue(entry.resourceId), description, unit: resourceUnit, quantity, unitPrice, resourceType, sortOrder };
  });
  if (resources.some((resource) => resource === undefined)) return undefined;
  return { apuId, name, unit, performance, scope: "PROJECT", companyId, projectId, resources: resources as NonNullable<BridgeInput["apuBefore"]>["resources"] };
}

export async function processPersistedReviewLearning(input: { decisionId: string; actorUserId: string; correlationId: string }) {
  const decision = await prisma.findingDecision.findUnique({
    where: { id: input.decisionId },
    select: {
      id: true, companyId: true, projectId: true, resolution: true, correctionVersionId: true, createdAt: true,
      finding: {
        select: {
          id: true, findingType: true, evidenceId: true, confidence: true, comparisonJson: true,
          evidence: { select: { knowledgeEvidenceLinks: { select: { knowledgeEvidenceId: true, knowledgeEvidence: { select: { sourceId: true } } } } } },
        },
      },
    },
  });
  if (!decision) throw new Error("Persisted review decision not found");
  const canonical = await resolvePersistedReviewCanonicalEntities({ findingId: decision.finding.id, companyId: decision.companyId, projectId: decision.projectId });
  const link = decision.finding.evidence.knowledgeEvidenceLinks[0];
  if (!link) return { status: "SKIPPED" as const, observationIds: [], apuVersionIds: [], skipReasons: ["MISSING_KNOWLEDGE_PROVENANCE"] };
  const comparison = jsonRecord(decision.finding.comparisonJson);
  const details = jsonRecord(comparison.details);
  return processReviewLearning({
    findingId: decision.finding.id,
    decisionId: decision.id,
    actorUserId: input.actorUserId,
    correlationId: input.correlationId,
    companyId: decision.companyId,
    projectId: decision.projectId,
    sourceId: link.knowledgeEvidence.sourceId,
    evidenceId: link.knowledgeEvidenceId,
    observedAt: decision.createdAt,
    confidence: decision.finding.confidence as BridgeInput["confidence"],
    resolution: String(decision.resolution),
    findingType: String(decision.finding.findingType),
    canonicalItemId: canonical.canonicalItemId,
    resourceId: canonical.resourceId,
    comparison: { documentValue: stringValue(comparison.documentValue), unit: stringValue(comparison.unit), currency: stringValue(comparison.currency) },
    correctionVersionId: decision.correctionVersionId ?? undefined,
    apuBefore: readApuSnapshot(details.apuBefore, decision.companyId, decision.projectId),
    apuAfter: readApuSnapshot(details.apuAfter, decision.companyId, decision.projectId),
  }, { recordEvent: false });
}
