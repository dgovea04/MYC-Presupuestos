import { prisma } from "@/lib/db/prisma";
import { processPersistedReviewLearning } from "./learning-bridge";
import { getKnowledgeRetryDecision } from "./retry-policy";
import { logKnowledgeOperation } from "./observability";

const MAX_ATTEMPTS = 5;
const ACTIVE_STATUSES = ["PENDING", "RETRYABLE_FAILED"] as const;

export async function createKnowledgeIntegrationJob(input: { idempotencyKey: string; companyId: string; projectId: string; findingId: string; decisionId: string; actorUserId?: string }) {
  return prisma.knowledgeIntegrationJob.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: { ...input, status: "PENDING", attemptCount: 0 },
    update: {},
  });
}

export async function markKnowledgeIntegrationJobRetryable(jobId: string, errorMessage: string, nextRetryAt: Date) {
  return prisma.knowledgeIntegrationJob.update({ where: { id: jobId }, data: { status: "RETRYABLE_FAILED", errorMessage, nextRetryAt, attemptCount: { increment: 1 } } });
}

export async function retryKnowledgeIntegrationJob(jobId: string) {
  return prisma.knowledgeIntegrationJob.update({ where: { id: jobId }, data: { status: "PENDING", nextRetryAt: new Date(), errorCode: null, errorMessage: null } });
}

async function claimKnowledgeIntegrationJob(jobId: string, now: Date) {
  const job = await prisma.knowledgeIntegrationJob.findFirst({ where: { id: jobId, status: { in: [...ACTIVE_STATUSES] }, attemptCount: { lt: MAX_ATTEMPTS } } });
  if (!job) return undefined;
  const claimed = await prisma.knowledgeIntegrationJob.updateMany({
    where: { id: jobId, status: job.status, attemptCount: { lt: MAX_ATTEMPTS } },
    data: { status: "PROCESSING", attemptCount: { increment: 1 }, lastAttemptAt: now, errorCode: null, errorMessage: null },
  });
  if (claimed.count !== 1) return undefined;
  return { ...job, attemptCount: job.attemptCount + 1 };
}

export async function processKnowledgeIntegrationJob(jobId: string, options: { now?: Date } = {}) {
  const now = options.now ?? new Date();
  const job = await claimKnowledgeIntegrationJob(jobId, now);
  if (!job) return { status: "NOT_CLAIMED" as const, jobId };
  try {
    const result = await processPersistedReviewLearning({ decisionId: job.decisionId, actorUserId: job.actorUserId ?? "system:knowledge-worker", correlationId: `knowledge-job:${job.id}` });
    if (result.status === "RETRYABLE_FAILURE") return markJobFailure(job, "KNOWLEDGE_WRITE_FAILED", result.skipReasons.join(", "), now);
    await prisma.knowledgeIntegrationJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", completedAt: now, nextRetryAt: null, errorCode: null, errorMessage: null } });
    logKnowledgeOperation({ stage: "retry", outcome: "success", correlationId: `knowledge-job:${job.id}`, companyId: job.companyId, projectId: job.projectId, findingId: job.findingId, decisionId: job.decisionId, idempotencyKey: job.idempotencyKey, retryCount: job.attemptCount });
    return { status: "SUCCEEDED" as const, jobId: job.id, result };
  } catch (error) {
    return markJobFailure(job, "WORKER_ERROR", error instanceof Error ? error.message : "Knowledge worker failed", now);
  }
}

async function markJobFailure(job: { id: string; attemptCount: number; companyId?: string; projectId?: string; findingId?: string; decisionId?: string; idempotencyKey?: string }, errorCode: string, errorMessage: string, now: Date) {
  const decision = job.attemptCount >= MAX_ATTEMPTS ? { retryable: false, attempt: job.attemptCount } : getKnowledgeRetryDecision(job.attemptCount, now);
  const terminal = await prisma.knowledgeIntegrationJob.update({
    where: { id: job.id },
    data: decision.retryable
      ? { status: "RETRYABLE_FAILED", attemptCount: decision.attempt, errorCode, errorMessage, nextRetryAt: decision.nextRetryAt }
      : { status: "DEAD_LETTER", attemptCount: decision.attempt, errorCode, errorMessage, nextRetryAt: null, completedAt: now },
  });
  logKnowledgeOperation({ stage: "retry", outcome: decision.retryable ? "retry" : "failure", correlationId: `knowledge-job:${job.id}`, companyId: job.companyId, projectId: job.projectId, findingId: job.findingId, decisionId: job.decisionId, idempotencyKey: job.idempotencyKey, retryCount: decision.attempt, errorCode, metadata: { errorMessage, terminal: !decision.retryable } });
  return { status: decision.retryable ? "RETRYABLE_FAILED" as const : "DEAD_LETTER" as const, jobId: job.id, job: terminal };
}

export async function processDueKnowledgeIntegrationJobs(options: { now?: Date; limit?: number } = {}) {
  const now = options.now ?? new Date();
  const jobs = await prisma.knowledgeIntegrationJob.findMany({ where: { status: { in: [...ACTIVE_STATUSES] }, attemptCount: { lt: MAX_ATTEMPTS }, OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] }, orderBy: [{ nextRetryAt: "asc" }, { createdAt: "asc" }], take: options.limit ?? 10 });
  return Promise.all(jobs.map((job) => processKnowledgeIntegrationJob(job.id, { now })));
}

export async function listKnowledgeIntegrationJobs(filters: { companyId?: string; projectId?: string; status?: string; limit?: number } = {}) {
  return prisma.knowledgeIntegrationJob.findMany({
    where: { ...(filters.companyId ? { companyId: filters.companyId } : {}), ...(filters.projectId ? { projectId: filters.projectId } : {}), ...(filters.status ? { status: filters.status } : {}) },
    orderBy: { updatedAt: "desc" }, take: Math.min(filters.limit ?? 50, 100),
  });
}
