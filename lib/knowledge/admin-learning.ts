import { Prisma, type KnowledgeConfidence, type KnowledgeStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordKnowledgeEvent } from "./events";
import { assertKnowledgeReadAccess, assertKnowledgeWriteAccess } from "./api-access";

type ImportDomain = "ITEM" | "RESOURCE" | "PRICE" | "YIELD" | "APU";

export const importStatuses: readonly KnowledgeStatus[] = ["OBSERVED", "REVIEW_REQUIRED", "CONFIRMED", "VERIFIED", "CANONICAL", "REJECTED", "DEPRECATED"];
export const importDomains: readonly ImportDomain[] = ["ITEM", "RESOURCE", "PRICE", "YIELD", "APU"];

export type ImportLearningAdminFilters = {
  actorUserId: string;
  companyId: string;
  projectId?: string;
  status?: KnowledgeStatus;
  sourceType?: string;
  domain?: ImportDomain;
  confidence?: KnowledgeConfidence;
  regionId?: string;
  page?: number;
  pageSize?: number;
};

export async function listImportLearningReview(filters: ImportLearningAdminFilters) {
  await assertKnowledgeReadAccess({ actorUserId: filters.actorUserId, companyId: filters.companyId, projectId: filters.projectId, scope: filters.projectId ? "PROJECT" : "COMPANY" });
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const sourceIds = filters.sourceType
    ? (await prisma.knowledgeSource.findMany({ where: { sourceType: filters.sourceType, companyId: filters.companyId, ...(filters.projectId ? { projectId: filters.projectId } : {}) }, select: { id: true } })).map((row) => row.id)
    : undefined;
  const sourceFilter = sourceIds ? { sourceId: { in: sourceIds } } : {};
  const tenant = { companyId: filters.companyId, ...(filters.projectId ? { projectId: filters.projectId } : {}) };
  const assertionWhere = {
    ...tenant,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.confidence ? { confidence: filters.confidence } : {}),
    ...(filters.domain ? { subjectType: `IMPORT_${filters.domain}` } : {}),
    ...sourceFilter,
  };
  const observationWhere = {
    ...tenant,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.confidence ? { confidence: filters.confidence } : {}),
    ...(filters.regionId ? { regionId: filters.regionId } : {}),
    ...sourceFilter,
  };
  const [assertionTotal, assertions, prices, yields] = await Promise.all([
    prisma.knowledgeAssertion.count({ where: assertionWhere }),
    prisma.knowledgeAssertion.findMany({
      where: assertionWhere,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, subjectType: true, subjectId: true, predicate: true, value: true, scope: true, status: true, confidence: true,
        companyId: true, projectId: true, sourceId: true, evidenceId: true, reviewFindingId: true, reviewDecisionId: true,
        createdAt: true, updatedAt: true,
      },
    }),
    filters.domain && filters.domain !== "PRICE" ? [] : prisma.priceObservation.findMany({ where: observationWhere, orderBy: { observedAt: "desc" }, take: pageSize, select: { id: true, resourceId: true, value: true, currency: true, unit: true, regionId: true, scope: true, status: true, confidence: true, companyId: true, projectId: true, sourceId: true, evidenceId: true, observedAt: true } }),
    filters.domain && filters.domain !== "YIELD" ? [] : prisma.yieldObservation.findMany({ where: observationWhere, orderBy: { observedAt: "desc" }, take: pageSize, select: { id: true, canonicalItemId: true, value: true, unit: true, regionId: true, scope: true, status: true, confidence: true, companyId: true, projectId: true, sourceId: true, evidenceId: true, observedAt: true } }),
  ]);
  const ids = assertions.map((row) => row.sourceId).filter((id): id is string => Boolean(id));
  const evidenceIds = assertions.map((row) => row.evidenceId).filter((id): id is string => Boolean(id));
  const [sources, evidence] = await Promise.all([
    ids.length ? prisma.knowledgeSource.findMany({ where: { id: { in: ids } }, select: { id: true, sourceType: true, label: true } }) : [],
    evidenceIds.length ? prisma.knowledgeEvidence.findMany({ where: { id: { in: evidenceIds } }, select: { id: true, fileName: true, page: true, sheet: true, cellRange: true, quote: true } }) : [],
  ]);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const evidenceById = new Map(evidence.map((row) => [row.id, row]));
  const enrichedAssertions = assertions.map((row) => ({ ...row, source: row.sourceId ? sourceById.get(row.sourceId) ?? null : null, evidence: row.evidenceId ? evidenceById.get(row.evidenceId) ?? null : null }));
  return {
    assertions: enrichedAssertions,
    prices,
    yields,
    pagination: { page, pageSize, total: assertionTotal, totalPages: Math.max(1, Math.ceil(assertionTotal / pageSize)) },
  };
}

export async function correctImportLearningAssertion(input: {
  actorUserId: string;
  companyId: string;
  projectId: string;
  assertionId: string;
  value: Record<string, unknown>;
  reason: string;
  correlationId: string;
}) {
  if (!input.reason.trim() || !input.correlationId.trim()) throw new Error("reason and correlationId are required");
  await assertKnowledgeWriteAccess({ actorUserId: input.actorUserId, companyId: input.companyId, projectId: input.projectId, scope: "PROJECT" });
  const original = await prisma.knowledgeAssertion.findUnique({
    where: { id: input.assertionId },
    select: { id: true, subjectType: true, subjectId: true, predicate: true, scope: true, status: true, confidence: true, companyId: true, projectId: true, sourceId: true, evidenceId: true, value: true },
  });
  if (!original || original.companyId !== input.companyId || original.projectId !== input.projectId || !original.subjectType.startsWith("IMPORT_")) throw new Error("Import learning assertion not found");
  if (original.status === "REJECTED" || original.status === "DEPRECATED") throw new Error("Assertion cannot be corrected");
  const correctionKey = `import-learning-correction:${original.id}:${input.correlationId}`;
  const corrected = await prisma.knowledgeAssertion.upsert({
    where: { idempotencyKey: correctionKey },
    create: {
      idempotencyKey: correctionKey,
      subjectType: original.subjectType,
      subjectId: `${original.subjectId}:correction:${input.correlationId}`,
      predicate: original.predicate,
      value: toJson({ ...input.value, correctsAssertionId: original.id }),
      scope: "PROJECT",
      status: "REVIEW_REQUIRED",
      confidence: original.confidence,
      companyId: input.companyId,
      projectId: input.projectId,
      sourceId: original.sourceId,
      evidenceId: original.evidenceId,
      createdById: input.actorUserId,
    },
    update: {},
  });
  await recordKnowledgeEvent({
    eventType: "KNOWLEDGE_IMPORT_ASSERTION_CORRECTED",
    scope: "PROJECT",
    companyId: input.companyId,
    projectId: input.projectId,
    userId: input.actorUserId,
    entityType: "KnowledgeAssertion",
    entityId: corrected.id,
    sourceType: "IMPORT_LEARNING_REVIEW",
    sourceId: original.sourceId ?? undefined,
    evidenceId: original.evidenceId ?? undefined,
    previousValue: original.value,
    newValue: input.value,
    metadata: { reason: input.reason, correlationId: input.correlationId, originalAssertionId: original.id },
    idempotencyKey: `import-learning-correction-event:${original.id}:${input.correlationId}`,
  });
  return { originalAssertionId: original.id, correctedAssertionId: corrected.id, status: corrected.status };
}

function toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
