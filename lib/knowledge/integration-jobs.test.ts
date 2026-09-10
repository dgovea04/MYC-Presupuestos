import { beforeEach, describe, expect, it, vi } from "vitest";

const { job, processPersistedReviewLearning } = vi.hoisted(() => ({
  job: {
    upsert: vi.fn().mockResolvedValue({ id: "job-1", status: "PENDING" }),
    update: vi.fn().mockResolvedValue({ id: "job-1", status: "RETRYABLE_FAILED" }),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  processPersistedReviewLearning: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { knowledgeIntegrationJob: job } }));
vi.mock("./learning-bridge", () => ({ processPersistedReviewLearning }));

import { createKnowledgeIntegrationJob, listKnowledgeIntegrationJobs, markKnowledgeIntegrationJobRetryable, processDueKnowledgeIntegrationJobs, processKnowledgeIntegrationJob, retryKnowledgeIntegrationJob } from "./integration-jobs";

describe("knowledge integration jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processPersistedReviewLearning.mockResolvedValue({ status: "SKIPPED", observationIds: [], apuVersionIds: [], skipReasons: [] });
  });
  it("creates or reuses a job by deterministic key", async () => {
    await createKnowledgeIntegrationJob({ idempotencyKey: "review:d1", companyId: "c1", projectId: "p1", findingId: "f1", decisionId: "d1" });
    expect(job.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { idempotencyKey: "review:d1" }, create: expect.objectContaining({ status: "PENDING" }) }));
  });

  it("records a retryable failure without deleting the job", async () => {
    await markKnowledgeIntegrationJobRetryable("job-1", "database unavailable", new Date("2026-09-09T12:00:00Z"));
    expect(job.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "job-1" }, data: expect.objectContaining({ status: "RETRYABLE_FAILED", errorMessage: "database unavailable" }) }));
  });

  it("requeues only retryable jobs", async () => {
    job.findFirst.mockResolvedValueOnce({ id: "job-1" });
    job.update.mockResolvedValueOnce({ id: "job-1", status: "PENDING" });
    await retryKnowledgeIntegrationJob("job-1");
    expect(job.update).toHaveBeenCalledWith({ where: { id: "job-1" }, data: { status: "PENDING", nextRetryAt: expect.any(Date), errorCode: null, errorMessage: null } });
  });

  it("claims due jobs atomically and increments the attempt count", async () => {
    job.findFirst.mockResolvedValueOnce({ id: "job-1", status: "PENDING", attemptCount: 0 });
    job.updateMany.mockResolvedValueOnce({ count: 1 });
    const result = await processKnowledgeIntegrationJob("job-1", { now: new Date("2026-09-09T12:00:00Z") });
    expect(result.status).toBe("SUCCEEDED");
    expect(job.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "job-1", status: "PENDING", attemptCount: { lt: 5 } }, data: expect.objectContaining({ status: "PROCESSING", attemptCount: { increment: 1 } }) }));
  });

  it("moves a permanently failing job to DEAD_LETTER after the fifth attempt", async () => {
    job.findFirst.mockResolvedValueOnce({ id: "job-1", status: "RETRYABLE_FAILED", attemptCount: 4 });
    job.updateMany.mockResolvedValueOnce({ count: 1 });
    processPersistedReviewLearning.mockRejectedValueOnce(new Error("knowledge unavailable"));
    job.update.mockResolvedValueOnce({ id: "job-1", status: "DEAD_LETTER" });
    const result = await processKnowledgeIntegrationJob("job-1", { now: new Date("2026-09-09T12:00:00Z") });
    expect(result.status).toBe("DEAD_LETTER");
    expect(job.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "job-1" }, data: expect.objectContaining({ status: "DEAD_LETTER", attemptCount: 5 }) }));
  });

  it("lists terminal and retryable jobs for operational visibility", async () => {
    job.findMany.mockResolvedValueOnce([{ id: "job-1", status: "SUCCEEDED" }]);
    await listKnowledgeIntegrationJobs({ companyId: "c1", limit: 25 });
    expect(job.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: "c1" }, take: 25 }));
  });

  it("processes only due jobs in a bounded worker batch", async () => {
    job.findMany.mockResolvedValueOnce([{ id: "job-1" }, { id: "job-2" }]);
    job.findFirst.mockResolvedValue(null);
    const results = await processDueKnowledgeIntegrationJobs({ now: new Date("2026-09-09T12:00:00Z"), limit: 2 });
    expect(results).toHaveLength(2);
    expect(job.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2, where: expect.objectContaining({ status: { in: ["PENDING", "RETRYABLE_FAILED"] } }) }));
  });
});
