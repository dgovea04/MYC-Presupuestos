import { prisma } from "@/lib/db/prisma";
import type { KnowledgeConfidence, KnowledgeScope, KnowledgeStatus } from "@prisma/client";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { recordKnowledgeEvent } from "./events";
import { logKnowledgeOperation } from "./observability";
import { promoteImportAssertionToCatalog } from "./canonical-promotion";

const DEFAULT_MIN_VERIFICATION_PROJECTS = 3;

const transitions: Readonly<Record<KnowledgeStatus, readonly KnowledgeStatus[]>> = {
  OBSERVED: ["REVIEW_REQUIRED", "CONFIRMED", "REJECTED"],
  REVIEW_REQUIRED: ["CONFIRMED", "REJECTED"],
  CONFIRMED: ["VERIFIED", "REJECTED", "DEPRECATED"],
  VERIFIED: ["CANONICAL", "DEPRECATED"],
  CANONICAL: ["DEPRECATED"],
  REJECTED: [],
  DEPRECATED: [],
};

export function assertAssertionTransition(current: KnowledgeStatus, next: KnowledgeStatus): void {
  if (!transitions[current].includes(next)) throw new Error("Invalid assertion transition");
}

export async function createKnowledgeAssertion(input: { idempotencyKey: string; subjectType: string; subjectId: string; predicate: string; value: object; scope: KnowledgeScope; companyId?: string; projectId?: string; confidence: KnowledgeConfidence; sourceId?: string; evidenceId?: string; reviewFindingId?: string; reviewDecisionId?: string; createdById: string; status?: KnowledgeStatus }) {
  if (input.scope !== "GLOBAL") {
    if (!input.companyId) throw new Error("companyId is required for assertion scope");
    await assertWorkspaceMembership({ userId: input.createdById, companyId: input.companyId, minimumRole: "EDITOR" });
  }
  return prisma.knowledgeAssertion.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: { ...input, status: input.status ?? "OBSERVED" },
    update: {},
  });
}

export async function transitionKnowledgeAssertion(input: { assertionId: string; nextStatus: KnowledgeStatus; actorUserId: string; companyId: string; projectId?: string; rejectionReason?: string; correlationId?: string; allowGlobalPromotion?: boolean; promotionScope?: "COMPANY" | "GLOBAL"; reviewDecisionId?: string }) {
  if (!input.actorUserId.trim()) throw new Error("actor is required");
  await assertWorkspaceMembership({ userId: input.actorUserId, companyId: input.companyId, minimumRole: "EDITOR" });
  const current = await prisma.knowledgeAssertion.findUnique({ where: { id: input.assertionId }, select: { id: true, status: true, scope: true, companyId: true, projectId: true, sourceId: true, evidenceId: true, subjectType: true, predicate: true, value: true } });
  if (!current || current.companyId !== input.companyId || (input.projectId !== undefined && current.projectId !== input.projectId)) throw new Error("Knowledge tenant access denied");
  const currentValue = isRecord(current.value) ? current.value : {};
  assertAssertionTransition(current.status, input.nextStatus);
  if ((input.nextStatus === "REJECTED" || input.nextStatus === "DEPRECATED") && !input.rejectionReason?.trim()) throw new Error("reason/rejectionReason is required for this transition");
  if (["CONFIRMED", "VERIFIED", "CANONICAL"].includes(input.nextStatus) && (!current.sourceId || !current.evidenceId)) throw new Error("Assertion provenance is required for this transition");
  if (!input.correlationId?.trim()) throw new Error("correlationId is required for assertion transitions");
  const promotionScope = input.promotionScope ?? "GLOBAL";
  if (input.nextStatus === "CANONICAL" && promotionScope === "GLOBAL" && !input.allowGlobalPromotion) throw new Error("Explicit GLOBAL promotion authorization is required");
  let confirmedReviewDecisionId: string | undefined;
  let catalogReference: { catalogEntityType: "CanonicalItem" | "CanonicalResource"; catalogEntityId: string } | undefined;
  if (input.nextStatus === "CANONICAL") {
    if (!input.reviewDecisionId?.trim()) throw new Error("A confirmed review decision is required for promotion");
    const decision = await prisma.findingDecision.findUnique({ where: { id: input.reviewDecisionId }, select: { id: true, companyId: true, projectId: true, resolution: true } });
    if (!decision || decision.companyId !== input.companyId || decision.projectId !== current.projectId || !["CONFIRMED_ISSUE", "CORRECTED"].includes(decision.resolution)) throw new Error("A confirmed review decision is required for promotion");
    confirmedReviewDecisionId = decision.id;
    if (current.subjectType === "IMPORT_ITEM" || current.subjectType === "IMPORT_RESOURCE") {
      if (!current.sourceId || !current.evidenceId || !isRecord(current.value)) throw new Error("Import catalog promotion requires a structured value and provenance");
      catalogReference = await promoteImportAssertionToCatalog({ assertionId: current.id, subjectType: current.subjectType, value: currentValue, scope: promotionScope, companyId: input.companyId, sourceId: current.sourceId, evidenceId: current.evidenceId });
    }
  }
  if (input.nextStatus === "VERIFIED") await assertMinimumVerificationProjects(current, input.companyId);
  const promoted = input.nextStatus === "CANONICAL";
  const promotedGlobal = promoted && promotionScope === "GLOBAL";
  const updated = await prisma.knowledgeAssertion.update({ where: { id: input.assertionId }, data: { status: input.nextStatus, updatedById: input.actorUserId, rejectionReason: input.rejectionReason, ...(promoted ? { reviewDecisionId: confirmedReviewDecisionId, value: catalogReference ? { ...currentValue, canonicalEntity: catalogReference } : undefined, scope: promotionScope, ...(promotedGlobal ? { companyId: null, projectId: null } : { companyId: input.companyId, projectId: null }) } : {}) } });
  await recordKnowledgeEvent({ eventType: "KNOWLEDGE_ASSERTION_TRANSITION", scope: promoted ? promotionScope : current.scope, companyId: promotedGlobal ? undefined : input.companyId, projectId: promoted ? undefined : current.projectId ?? undefined, userId: input.actorUserId, entityType: "KnowledgeAssertion", entityId: current.id, sourceType: "KNOWLEDGE_ASSERTION_LIFECYCLE", sourceId: current.sourceId ?? undefined, evidenceId: current.evidenceId ?? undefined, previousValue: { status: current.status, scope: current.scope }, newValue: { status: input.nextStatus, scope: promoted ? promotionScope : current.scope }, metadata: { correlationId: input.correlationId, previousStatus: current.status, nextStatus: input.nextStatus, ...(promoted ? { promotionScope } : {}), ...(input.rejectionReason ? { reason: input.rejectionReason } : {}) }, idempotencyKey: `assertion-transition:${current.id}:${current.status}:${input.nextStatus}:${input.correlationId}` });
  if (promoted) logKnowledgeOperation({ stage: "promotion", outcome: "success", correlationId: input.correlationId, companyId: input.companyId, projectId: input.projectId, idempotencyKey: `assertion-transition:${current.id}:${current.status}:${input.nextStatus}:${input.correlationId}`, metadata: { assertionId: current.id, fromScope: current.scope, toScope: promotionScope } });
  return updated;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function assertMinimumVerificationProjects(current: { subjectType: string; predicate: string; projectId: string | null }, companyId: string) {
  const configuredMinimum = Number(process.env.MC_KNOWLEDGE_MIN_VERIFICATION_PROJECTS ?? String(DEFAULT_MIN_VERIFICATION_PROJECTS));
  const minimum = Number.isInteger(configuredMinimum) && configuredMinimum > 0 ? configuredMinimum : DEFAULT_MIN_VERIFICATION_PROJECTS;
  const corroborating = await prisma.knowledgeAssertion.findMany({
    where: { subjectType: current.subjectType, predicate: current.predicate, companyId, status: { in: ["CONFIRMED", "VERIFIED"] }, projectId: { not: null } },
    select: { projectId: true },
  });
  const projectIds = new Set(corroborating.map((row) => row.projectId).filter((projectId): projectId is string => Boolean(projectId)));
  if (current.projectId) projectIds.add(current.projectId);
  if (projectIds.size < minimum) throw new Error(`Verification requires observations from ${minimum} distinct projects`);
}

export async function createKnowledgeAssertionConflict(input: { idempotencyKey: string; assertionId: string; conflictingAssertionId: string; companyId: string; projectId?: string; reason: string; actorUserId: string }) {
  if (input.assertionId === input.conflictingAssertionId) throw new Error("An assertion cannot conflict with itself");
  if (!input.reason.trim()) throw new Error("reason is required for assertion conflicts");
  await assertWorkspaceMembership({ userId: input.actorUserId, companyId: input.companyId, minimumRole: "EDITOR" });
  return prisma.knowledgeAssertionConflict.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: { idempotencyKey: input.idempotencyKey, assertionId: input.assertionId, conflictingAssertionId: input.conflictingAssertionId, reason: input.reason, status: "OPEN" },
    update: {},
  });
}

export async function resolveKnowledgeAssertionConflict(input: { conflictId: string; actorUserId: string; companyId: string; projectId?: string; resolution: "RESOLVED" | "DISMISSED"; reason: string; correlationId: string }) {
  if (!input.reason.trim()) throw new Error("reason is required to resolve an assertion conflict");
  await assertWorkspaceMembership({ userId: input.actorUserId, companyId: input.companyId, minimumRole: "EDITOR" });
  const conflict = await prisma.knowledgeAssertionConflict.findUnique({ where: { id: input.conflictId }, select: { id: true, status: true, assertion: { select: { companyId: true, projectId: true } }, conflictingAssertion: { select: { companyId: true, projectId: true } } } });
  if (!conflict || conflict.assertion.companyId !== input.companyId || conflict.conflictingAssertion.companyId !== input.companyId || (input.projectId !== undefined && (conflict.assertion.projectId !== input.projectId || conflict.conflictingAssertion.projectId !== input.projectId))) throw new Error("Knowledge assertion conflict not found");
  if (conflict.status !== "OPEN") throw new Error("Knowledge assertion conflict is already closed");
  const updated = await prisma.knowledgeAssertionConflict.update({ where: { id: input.conflictId }, data: { status: input.resolution, reason: input.reason, resolvedById: input.actorUserId, resolvedAt: new Date() } });
  await recordKnowledgeEvent({ eventType: "KNOWLEDGE_ASSERTION_CONFLICT_RESOLVED", scope: "PROJECT", companyId: input.companyId, projectId: input.projectId, userId: input.actorUserId, entityType: "KnowledgeAssertionConflict", entityId: conflict.id, sourceType: "KNOWLEDGE_ASSERTION_LIFECYCLE", metadata: { correlationId: input.correlationId, resolution: input.resolution, reason: input.reason }, idempotencyKey: `assertion-conflict:${conflict.id}:${input.resolution}:${input.correlationId}` });
  return updated;
}
