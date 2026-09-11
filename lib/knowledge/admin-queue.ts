import { prisma } from "@/lib/db/prisma";
import type { KnowledgeStatus } from "@prisma/client";

export async function getKnowledgeAdminQueue(filters: { companyId?: string; projectId?: string; status?: string } = {}) {
  const tenant = { ...(filters.companyId ? { companyId: filters.companyId } : {}), ...(filters.projectId ? { projectId: filters.projectId } : {}) };
  const assertionStatuses = ["OBSERVED", "REVIEW_REQUIRED", "CONFIRMED", "VERIFIED", "CANONICAL", "REJECTED", "DEPRECATED"] as const;
  const assertionStatus = filters.status && assertionStatuses.includes(filters.status as typeof assertionStatuses[number]) ? filters.status as KnowledgeStatus : undefined;
  const pendingAssertionWhere = assertionStatus
    ? { status: assertionStatus }
    : filters.status
      ? {}
      : { status: { in: ["OBSERVED", "REVIEW_REQUIRED"] as KnowledgeStatus[] } };
  const [pendingAssertions, recentPrices, recentYields, retryableJobs] = await Promise.all([
    prisma.knowledgeAssertion.findMany({ where: { ...pendingAssertionWhere, ...tenant }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, subjectType: true, subjectId: true, predicate: true, value: true, scope: true, status: true, confidence: true, companyId: true, projectId: true, sourceId: true, evidenceId: true, reviewFindingId: true, reviewDecisionId: true, updatedAt: true } }),
    prisma.priceObservation.findMany({ where: tenant, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, resourceId: true, value: true, unit: true, scope: true, confidence: true, companyId: true, projectId: true, evidenceId: true, observedAt: true } }),
    prisma.yieldObservation.findMany({ where: tenant, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, canonicalItemId: true, value: true, unit: true, scope: true, confidence: true, companyId: true, projectId: true, evidenceId: true, observedAt: true } }),
    prisma.knowledgeIntegrationJob.findMany({ where: { ...tenant, ...(filters.status && ["PENDING", "PROCESSING", "RETRYABLE_FAILED", "SUCCEEDED", "DEAD_LETTER"].includes(filters.status) ? { status: filters.status } : {}) }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, idempotencyKey: true, jobType: true, status: true, attemptCount: true, nextRetryAt: true, errorCode: true, errorMessage: true, lastAttemptAt: true, completedAt: true, companyId: true, projectId: true, findingId: true, decisionId: true } }),
  ]);
  return { pendingAssertions, recentPrices, recentYields, retryableJobs };
}
