import { prisma } from "@/lib/db/prisma";
import { getKnowledgeAdminQueue } from "@/lib/knowledge/admin-queue";
import { listImportLearningReview } from "@/lib/knowledge/admin-learning";

export type KnowledgeAdminDashboardFilters = {
  actorUserId?: string;
  companyId?: string;
  projectId?: string;
  status?: string;
};

export async function getKnowledgeAdminDashboard(filters: KnowledgeAdminDashboardFilters = {}) {
  const tenant = {
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
  };
  const companyTenant = filters.companyId ? { companyId: filters.companyId } : {};
  const importLearning = filters.actorUserId && filters.companyId
    ? listImportLearningReview({ actorUserId: filters.actorUserId, companyId: filters.companyId, projectId: filters.projectId, ...(filters.status && ["OBSERVED", "REVIEW_REQUIRED", "CONFIRMED", "VERIFIED", "CANONICAL", "REJECTED", "DEPRECATED"].includes(filters.status) ? { status: filters.status as "OBSERVED" | "REVIEW_REQUIRED" | "CONFIRMED" | "VERIFIED" | "CANONICAL" | "REJECTED" | "DEPRECATED" } : {}) })
    : Promise.resolve(null);
  const [counts, recentItems, recentResources, events, queue, evidence, conflicts, importReview] = await Promise.all([
    Promise.all([
      prisma.canonicalItem.count({ where: companyTenant }),
      prisma.canonicalResource.count({ where: companyTenant }),
      prisma.priceObservation.count({ where: tenant }),
      prisma.yieldObservation.count({ where: tenant }),
    ]),
    prisma.canonicalItem.findMany({ where: companyTenant, orderBy: { updatedAt: "desc" }, take: 20, include: { aliases: true } }),
    prisma.canonicalResource.findMany({ where: companyTenant, orderBy: { updatedAt: "desc" }, take: 20, include: { aliases: true } }),
    prisma.knowledgeEvent.findMany({ where: tenant, orderBy: { createdAt: "desc" }, take: 25, select: { id: true, eventType: true, scope: true, entityType: true, entityId: true, createdAt: true } }),
    getKnowledgeAdminQueue(filters),
    prisma.knowledgeEvidence.findMany({ where: tenant, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, sourceId: true, documentId: true, fileName: true, page: true, sheet: true, cellRange: true, quote: true, companyId: true, projectId: true, createdById: true, createdAt: true } }),
    prisma.knowledgeAssertionConflict.findMany({ where: { assertion: tenant }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, assertionId: true, conflictingAssertionId: true, status: true, reason: true, resolvedById: true, resolvedAt: true, createdAt: true, assertion: { select: { companyId: true, projectId: true } } } }),
    importLearning,
  ]);

  const [items, resources, priceCount, yieldCount] = counts;
  const assertions = queue.pendingAssertions.map((assertion) => ({ ...assertion, confidence: String(assertion.confidence), status: String(assertion.status), updatedAt: assertion.updatedAt.toISOString() }));
  const prices = queue.recentPrices.map((observation) => ({ ...observation, value: String(observation.value), confidence: String(observation.confidence), scope: String(observation.scope), observedAt: observation.observedAt.toISOString() }));
  const yields = queue.recentYields.map((observation) => ({ ...observation, value: String(observation.value), confidence: String(observation.confidence), scope: String(observation.scope), observedAt: observation.observedAt.toISOString() }));
  const promotionCandidates = assertions.filter((assertion) => assertion.status === "VERIFIED");
  const integrationErrors = queue.retryableJobs.filter((job) => job.status === "RETRYABLE_FAILED" || job.status === "DEAD_LETTER");
  const serialEvidence = evidence.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  const serialConflicts = conflicts.map((row) => ({ ...row, companyId: row.assertion.companyId, projectId: row.assertion.projectId, resolvedAt: row.resolvedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() }));

  return {
    counts: { items, resources, prices: priceCount, yields: yieldCount },
    recentItems,
    recentResources,
    events,
    evidence: serialEvidence,
    conflicts: serialConflicts,
    importLearning: importReview ? {
      ...importReview,
      assertions: importReview.assertions.map((assertion) => ({ ...assertion, status: String(assertion.status), confidence: String(assertion.confidence), updatedAt: assertion.updatedAt.toISOString() })),
      prices: importReview.prices.map((observation) => ({ ...observation, value: String(observation.value), status: String(observation.status), confidence: String(observation.confidence), scope: String(observation.scope), observedAt: observation.observedAt.toISOString() })),
      yields: importReview.yields.map((observation) => ({ ...observation, value: String(observation.value), status: String(observation.status), confidence: String(observation.confidence), scope: String(observation.scope), observedAt: observation.observedAt.toISOString() })),
    } : null,
    queue: { ...queue, assertions, pendingAssertions: assertions, recentPrices: prices, recentYields: yields, promotionCandidates, integrationErrors },
  };
}
