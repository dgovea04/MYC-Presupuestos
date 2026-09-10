import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordReviewDecisionKnowledgeEvent, createPriceObservation, createYieldObservation, persistReviewApuCorrection, createKnowledgeIntegrationJob } = vi.hoisted(() => ({
  recordReviewDecisionKnowledgeEvent: vi.fn().mockResolvedValue({ event: { id: "event-1" }, created: true }),
  createPriceObservation: vi.fn().mockResolvedValue({ id: "price-1" }),
  createYieldObservation: vi.fn().mockResolvedValue({ id: "yield-1" }),
  persistReviewApuCorrection: vi.fn().mockResolvedValue({ id: "apu-version-1" }),
  createKnowledgeIntegrationJob: vi.fn().mockResolvedValue({ id: "job-1" }),
}));
const { decisionFindUnique, resolvePersistedReviewCanonicalEntities } = vi.hoisted(() => ({ decisionFindUnique: vi.fn(), resolvePersistedReviewCanonicalEntities: vi.fn().mockResolvedValue({ canonicalItemId: "item-1", resourceId: undefined }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { findingDecision: { findUnique: decisionFindUnique } } }));
vi.mock("./integrations", () => ({ recordReviewDecisionKnowledgeEvent }));
vi.mock("./observations", () => ({ createPriceObservation, createYieldObservation }));
vi.mock("./apu", async () => ({ ...(await vi.importActual<typeof import("./apu")>("./apu")), persistReviewApuCorrection }));
vi.mock("./integration-jobs", () => ({ createKnowledgeIntegrationJob }));
vi.mock("./review-canonical-resolution", () => ({ resolvePersistedReviewCanonicalEntities }));

import { processPersistedReviewLearning, processReviewLearning } from "./learning-bridge";

const input = { findingId: "f1", decisionId: "d1", actorUserId: "u1", companyId: "c1", projectId: "p1", sourceId: "s1", evidenceId: "e1", observedAt: new Date("2026-09-09"), confidence: "HIGH" as const, resolution: "CONFIRMED_ISSUE", findingType: "YIELD_MISMATCH", canonicalItemId: "item-1", comparison: { documentValue: "0.80", unit: "m3" }, correlationId: "corr-1" };

describe("knowledge learning bridge", () => {
  beforeEach(() => vi.stubEnv("MC_KNOWLEDGE_REVIEW_LEARNING_BRIDGE", "true"));
  it("skips the persisted bridge when its server-side flag is disabled", async () => {
    vi.stubEnv("MC_KNOWLEDGE_REVIEW_LEARNING_BRIDGE", "false");
    await expect(processReviewLearning(input)).resolves.toMatchObject({ status: "SKIPPED", skipReasons: ["FEATURE_DISABLED"] });
    expect(recordReviewDecisionKnowledgeEvent).not.toHaveBeenCalled();
  });
  it("records the decision event and persists eligible observations", async () => {
    await expect(processReviewLearning(input)).resolves.toMatchObject({ status: "PROCESSED", eventId: "event-1", observationIds: ["yield-1"] });
    expect(recordReviewDecisionKnowledgeEvent).toHaveBeenCalledWith(expect.objectContaining({ decisionId: "d1", evidenceId: "e1" }));
    expect(createYieldObservation).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "review-yield:d1", scope: "PROJECT" }));
  });

  it("isolates a Knowledge failure as retryable", async () => {
    createYieldObservation.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(processReviewLearning(input)).resolves.toMatchObject({ status: "RETRYABLE_FAILURE", eventId: "event-1" });
    expect(createKnowledgeIntegrationJob).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "review-learning:d1", decisionId: "d1" }));
  });

  it("persists a corrected APU through the bridge without budget mutation", async () => {
    const apuInput = { ...input, resolution: "CORRECTED", findingType: "INCOMPLETE_APU", comparison: {}, correctionVersionId: "version-2", apuBefore: { apuId: "apu-1", name: "Concreto", unit: "M3", performance: "8", scope: "PROJECT" as const, companyId: "c1", projectId: "p1", resources: [] }, apuAfter: { apuId: "apu-1", name: "Concreto", unit: "M3", performance: "7", scope: "PROJECT" as const, companyId: "c1", projectId: "p1", resources: [] } };
    await expect(processReviewLearning(apuInput)).resolves.toMatchObject({ status: "PROCESSED", apuVersionIds: ["apu-version-1"] });
    expect(persistReviewApuCorrection).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "review-apu:d1:version-2" }));
  });

  it("builds observations from persisted decision data and resolves canonical ids conservatively", async () => {
    decisionFindUnique.mockResolvedValueOnce({ id: "d1", companyId: "c1", projectId: "p1", resolution: "CONFIRMED_ISSUE", correctionVersionId: null, createdAt: new Date("2026-09-09"), finding: { id: "f1", findingType: "YIELD_MISMATCH", evidenceId: "re1", confidence: "HIGH", comparisonJson: { documentValue: "0.8", unit: "m3" }, evidence: { knowledgeEvidenceLinks: [{ knowledgeEvidenceId: "ke1", knowledgeEvidence: { sourceId: "s1" } }] } } });
    await expect(processPersistedReviewLearning({ decisionId: "d1", actorUserId: "u1", correlationId: "corr-1" })).resolves.toMatchObject({ status: "PROCESSED", observationIds: ["yield-1"] });
    expect(resolvePersistedReviewCanonicalEntities).toHaveBeenCalledWith({ findingId: "f1", companyId: "c1", projectId: "p1" });
  });
});
