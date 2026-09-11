import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { processPersistedReviewLearning } from "./learning-bridge";
import { recordImportLearningBatch } from "./import-learning";
import { getKnowledgeRetryDecision } from "./retry-policy";
import { logKnowledgeOperation } from "./observability";
import type { ImportLearningBatch } from "./import-learning-types";

const MAX_ATTEMPTS = 5;
const ACTIVE_STATUSES = ["PENDING", "RETRYABLE_FAILED"] as const;

export async function createKnowledgeIntegrationJob(input: { idempotencyKey: string; companyId: string; projectId: string; findingId?: string; decisionId?: string; actorUserId?: string; jobType?: "REVIEW_LEARNING" | "IMPORT_LEARNING"; payload?: ImportLearningBatch }) {
  return prisma.knowledgeIntegrationJob.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      idempotencyKey: input.idempotencyKey,
      companyId: input.companyId,
      projectId: input.projectId,
      findingId: input.findingId,
      decisionId: input.decisionId,
      actorUserId: input.actorUserId,
      jobType: input.jobType ?? "REVIEW_LEARNING",
      payload: input.payload === undefined ? undefined : JSON.parse(JSON.stringify(input.payload)) as Prisma.InputJsonValue,
      status: "PENDING",
      attemptCount: 0,
    },
    update: {},
  });
}

export async function createImportLearningJob(input: { batch: ImportLearningBatch }) {
  return createKnowledgeIntegrationJob({
    idempotencyKey: `import-learning-job:${input.batch.importId}`,
    companyId: input.batch.companyId,
    projectId: input.batch.projectId,
    actorUserId: input.batch.createdById,
    jobType: "IMPORT_LEARNING",
    payload: input.batch,
  });
}

export async function markKnowledgeIntegrationJobRetryable(jobId: string, errorMessage: string, nextRetryAt: Date) {
  return prisma.knowledgeIntegrationJob.update({ where: { id: jobId }, data: { status: "RETRYABLE_FAILED", errorMessage, nextRetryAt, attemptCount: { increment: 1 } } });
}

export async function retryKnowledgeIntegrationJob(jobId: string, scope?: { companyId: string; projectId?: string }) {
  const job = await prisma.knowledgeIntegrationJob.findFirst({ where: { id: jobId, ...(scope ? { companyId: scope.companyId, ...(scope.projectId ? { projectId: scope.projectId } : {}) } : {}) }, select: { id: true } });
  if (!job) throw new Error("Knowledge job not found");
  return prisma.knowledgeIntegrationJob.update({ where: { id: job.id }, data: { status: "PENDING", nextRetryAt: new Date(), errorCode: null, errorMessage: null } });
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
    const result = job.jobType === "IMPORT_LEARNING"
      ? await processImportLearningJob(job)
      : await processPersistedReviewLearning({ decisionId: job.decisionId ?? "", actorUserId: job.actorUserId ?? "system:knowledge-worker", correlationId: `knowledge-job:${job.id}` });
    if (result.status === "RETRYABLE_FAILURE") return markJobFailure(job, "KNOWLEDGE_WRITE_FAILED", result.skipReasons.join(", "), now);
    await prisma.knowledgeIntegrationJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", completedAt: now, nextRetryAt: null, errorCode: null, errorMessage: null } });
    logKnowledgeOperation({ stage: "retry", outcome: "success", correlationId: `knowledge-job:${job.id}`, companyId: job.companyId, projectId: job.projectId, findingId: job.findingId ?? undefined, decisionId: job.decisionId ?? undefined, idempotencyKey: job.idempotencyKey, retryCount: job.attemptCount });
    return { status: "SUCCEEDED" as const, jobId: job.id, result };
  } catch (error) {
    return markJobFailure(job, "WORKER_ERROR", error instanceof Error ? error.message : "Knowledge worker failed", now);
  }
}

async function processImportLearningJob(job: { payload: unknown }) {
  if (!job.payload || typeof job.payload !== "object" || Array.isArray(job.payload)) throw new Error("IMPORT_LEARNING job payload is missing");
  const result = await recordImportLearningBatch(job.payload as ImportLearningBatch);
  if ("status" in result && result.status === "SKIPPED") return { status: "SKIPPED" as const, skipReasons: [result.reason] };
  return { status: "PROCESSED" as const, skipReasons: [] };
}

async function markJobFailure(job: { id: string; attemptCount: number; companyId?: string; projectId?: string; findingId?: string | null; decisionId?: string | null; idempotencyKey?: string }, errorCode: string, errorMessage: string, now: Date) {
  const decision = job.attemptCount >= MAX_ATTEMPTS ? { retryable: false, attempt: job.attemptCount } : getKnowledgeRetryDecision(job.attemptCount, now);
  const terminal = await prisma.knowledgeIntegrationJob.update({
    where: { id: job.id },
    data: decision.retryable
      ? { status: "RETRYABLE_FAILED", attemptCount: decision.attempt, errorCode, errorMessage, nextRetryAt: decision.nextRetryAt }
      : { status: "DEAD_LETTER", attemptCount: decision.attempt, errorCode, errorMessage, nextRetryAt: null, completedAt: now },
  });
  logKnowledgeOperation({ stage: "retry", outcome: decision.retryable ? "retry" : "failure", correlationId: `knowledge-job:${job.id}`, companyId: job.companyId, projectId: job.projectId, findingId: job.findingId ?? undefined, decisionId: job.decisionId ?? undefined, idempotencyKey: job.idempotencyKey, retryCount: decision.attempt, errorCode, metadata: { errorMessage, terminal: !decision.retryable } });
  return { status: decision.retryable ? "RETRYABLE_FAILED" as const : "DEAD_LETTER" as const, jobId: job.id, job: terminal };
}

export async function processDueKnowledgeIntegrationJobs(options: { now?: Date; limit?: number; jobId?: string } = {}) {
  const now = options.now ?? new Date();
  const jobs = await prisma.knowledgeIntegrationJob.findMany({ where: { ...(options.jobId ? { id: options.jobId } : {}), status: { in: [...ACTIVE_STATUSES] }, attemptCount: { lt: MAX_ATTEMPTS }, OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] }, orderBy: [{ nextRetryAt: "asc" }, { createdAt: "asc" }], take: options.jobId ? 1 : options.limit ?? 10 });
  return Promise.all(jobs.map((job) => processKnowledgeIntegrationJob(job.id, { now })));
}

export async function listKnowledgeIntegrationJobs(filters: { companyId?: string; projectId?: string; status?: string; limit?: number } = {}) {
  return prisma.knowledgeIntegrationJob.findMany({
    where: { ...(filters.companyId ? { companyId: filters.companyId } : {}), ...(filters.projectId ? { projectId: filters.projectId } : {}), ...(filters.status ? { status: filters.status } : {}) },
    orderBy: { updatedAt: "desc" }, take: Math.min(filters.limit ?? 50, 100),
  });
}
