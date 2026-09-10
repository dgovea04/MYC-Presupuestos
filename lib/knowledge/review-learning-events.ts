import { prisma } from "@/lib/db/prisma";
import { recordKnowledgeEvent } from "./events";

type ReviewResolution = "CONFIRMED_ISSUE" | "VALID_AS_IS" | "FALSE_POSITIVE" | "NEEDS_MORE_INFORMATION" | "NOT_APPLICABLE" | "CORRECTED";
type ReviewFindingType = "QUANTITY_MISMATCH" | "YIELD_MISMATCH" | "UNIT_INCONSISTENCY" | "TECHNICAL_SPEC_MISMATCH" | "MISSING_DOCUMENTATION" | "INCOMPLETE_APU" | "PRICE_MISMATCH";

const baseEvents: Record<ReviewResolution, string> = {
  CONFIRMED_ISSUE: "REVIEW_ISSUE_CONFIRMED",
  VALID_AS_IS: "REVIEW_ISSUE_REJECTED",
  FALSE_POSITIVE: "REVIEW_ISSUE_REJECTED",
  NOT_APPLICABLE: "REVIEW_ISSUE_REJECTED",
  NEEDS_MORE_INFORMATION: "REVIEW_ISSUE_PENDING",
  CORRECTED: "REVIEW_CORRECTION_CONFIRMED",
};

const findingEvents: Partial<Record<ReviewFindingType, string>> = {
  QUANTITY_MISMATCH: "REVIEW_ITEM_LINK_CONFIRMED",
  YIELD_MISMATCH: "REVIEW_YIELD_OBSERVED",
  UNIT_INCONSISTENCY: "REVIEW_UNIT_INCONSISTENCY_CONFIRMED",
  TECHNICAL_SPEC_MISMATCH: "REVIEW_RESOURCE_LINK_CONFIRMED",
  MISSING_DOCUMENTATION: "REVIEW_EVIDENCE_CONFIRMED",
  INCOMPLETE_APU: "REVIEW_APU_VERSION_OBSERVED",
  PRICE_MISMATCH: "REVIEW_PRICE_OBSERVED",
};

export function mapReviewDecisionToEventTypes(input: { resolution: string; findingType: string }): string[] {
  const resolution = input.resolution as ReviewResolution;
  const result = [baseEvents[resolution] ?? "REVIEW_ISSUE_PENDING"];
  if (resolution === "CONFIRMED_ISSUE" || resolution === "CORRECTED") {
    const specialized = findingEvents[input.findingType as ReviewFindingType];
    if (specialized) result.push(specialized);
  }
  return result;
}

type PersistedDecision = {
  id: string;
  companyId: string;
  projectId: string;
  resolution: string;
  correctionVersionId: string | null;
  finding: {
    id: string;
    findingType: string;
    evidenceId: string;
    evidence: { knowledgeEvidenceLinks: Array<{ knowledgeEvidenceId: string; knowledgeEvidence: { sourceId: string } }> };
  };
};

export async function recordPersistedReviewDecisionKnowledgeEvents(input: { decisionId: string; actorUserId: string; correlationId: string }) {
  const decision = await prisma.findingDecision.findUnique({
    where: { id: input.decisionId },
    select: {
      id: true,
      companyId: true,
      projectId: true,
      resolution: true,
      correctionVersionId: true,
      finding: {
        select: {
          id: true,
          findingType: true,
          evidenceId: true,
          evidence: { select: { knowledgeEvidenceLinks: { select: { knowledgeEvidenceId: true, knowledgeEvidence: { select: { sourceId: true } } } } } },
        },
      },
    },
  });
  if (!decision) throw new Error("Persisted review decision not found");
  const persisted = decision as PersistedDecision;
  const link = persisted.finding.evidence.knowledgeEvidenceLinks[0];
  const eventTypes = mapReviewDecisionToEventTypes({ resolution: persisted.resolution, findingType: persisted.finding.findingType });
  const events = [];
  for (const eventType of eventTypes) {
    const entityId = persisted.finding.id;
    events.push(await recordKnowledgeEvent({
      eventType,
      scope: "PROJECT",
      companyId: persisted.companyId,
      projectId: persisted.projectId,
      userId: input.actorUserId,
      entityType: "ReviewFinding",
      entityId,
      sourceType: "MC_REVISOR",
      sourceId: link?.knowledgeEvidence.sourceId,
      evidenceId: link?.knowledgeEvidenceId,
      newValue: { resolution: persisted.resolution, correctionVersionId: persisted.correctionVersionId },
      metadata: { mapper: "persisted-review-decision", payloadVersion: 1, decisionId: persisted.id, findingId: entityId, reviewEvidenceId: persisted.finding.evidenceId, correlationId: input.correlationId },
      idempotencyKey: `review-learning:${eventType}:${persisted.id}:${entityId}:${persisted.correctionVersionId ?? "none"}`,
    }));
  }
  return events;
}
