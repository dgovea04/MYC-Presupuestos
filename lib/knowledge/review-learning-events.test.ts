import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, recordKnowledgeEvent } = vi.hoisted(() => ({ findUnique: vi.fn(), recordKnowledgeEvent: vi.fn().mockResolvedValue({ event: { id: "event-1" }, created: true }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { findingDecision: { findUnique } } }));
vi.mock("./events", () => ({ recordKnowledgeEvent }));

import { mapReviewDecisionToEventTypes, recordPersistedReviewDecisionKnowledgeEvents } from "./review-learning-events";

describe("review learning event mapper", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["CONFIRMED_ISSUE", "REVIEW_ISSUE_CONFIRMED"],
    ["VALID_AS_IS", "REVIEW_ISSUE_REJECTED"],
    ["FALSE_POSITIVE", "REVIEW_ISSUE_REJECTED"],
    ["NOT_APPLICABLE", "REVIEW_ISSUE_REJECTED"],
    ["NEEDS_MORE_INFORMATION", "REVIEW_ISSUE_PENDING"],
    ["CORRECTED", "REVIEW_CORRECTION_CONFIRMED"],
  ] as const)("maps %s to %s", (resolution, eventType) => {
    expect(mapReviewDecisionToEventTypes({ resolution, findingType: "YIELD_MISMATCH" })).toContain(eventType);
  });

  it.each([
    ["QUANTITY_MISMATCH", "REVIEW_ITEM_LINK_CONFIRMED"],
    ["YIELD_MISMATCH", "REVIEW_YIELD_OBSERVED"],
    ["UNIT_INCONSISTENCY", "REVIEW_UNIT_INCONSISTENCY_CONFIRMED"],
    ["TECHNICAL_SPEC_MISMATCH", "REVIEW_RESOURCE_LINK_CONFIRMED"],
    ["MISSING_DOCUMENTATION", "REVIEW_EVIDENCE_CONFIRMED"],
    ["INCOMPLETE_APU", "REVIEW_APU_VERSION_OBSERVED"],
    ["PRICE_MISMATCH", "REVIEW_PRICE_OBSERVED"],
  ] as const)("covers %s learning event", (findingType, eventType) => {
    expect(mapReviewDecisionToEventTypes({ resolution: "CONFIRMED_ISSUE", findingType })).toContain(eventType);
  });

  it("loads the persisted decision and emits provenance-bound deterministic events", async () => {
    findUnique.mockResolvedValueOnce({
      id: "decision-1", companyId: "company-1", projectId: "project-1", resolution: "CONFIRMED_ISSUE", correctionVersionId: null,
      finding: { id: "finding-1", findingType: "YIELD_MISMATCH", evidenceId: "review-evidence-1", evidence: { knowledgeEvidenceLinks: [{ knowledgeEvidenceId: "knowledge-evidence-1", knowledgeEvidence: { sourceId: "source-1" } }] } },
    });

    await recordPersistedReviewDecisionKnowledgeEvents({ decisionId: "decision-1", actorUserId: "user-1", correlationId: "corr-1" });

    expect(recordKnowledgeEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "REVIEW_YIELD_OBSERVED", companyId: "company-1", projectId: "project-1", userId: "user-1", sourceId: "source-1", evidenceId: "knowledge-evidence-1", metadata: expect.objectContaining({ decisionId: "decision-1", findingId: "finding-1", correlationId: "corr-1" }), idempotencyKey: "review-learning:REVIEW_YIELD_OBSERVED:decision-1:finding-1:none" }));
  });

  it("does not trust requested tenant values when the persisted decision does not match them", async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(recordPersistedReviewDecisionKnowledgeEvents({ decisionId: "decision-1", actorUserId: "user-1", correlationId: "corr-1" })).rejects.toThrow("not found");
    expect(recordKnowledgeEvent).not.toHaveBeenCalled();
  });
});
