import { prisma } from "@/lib/db/prisma";
import type { KnowledgeConfidence, KnowledgeScope, KnowledgeStatus } from "@prisma/client";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { recordKnowledgeEvent } from "./events";
import { logKnowledgeOperation } from "./observability";

const transitions: Readonly<Record<KnowledgeStatus, readonly KnowledgeStatus[]>> = {
  OBSERVED: ["CONFIRMED", "REJECTED"],
  CONFIRMED: ["VERIFIED", "REJECTED", "DEPRECATED"],
  VERIFIED: ["CANONICAL", "DEPRECATED"],
  CANONICAL: ["DEPRECATED"],
  REJECTED: [],
  DEPRECATED: [],
};

export function assertAssertionTransition(current: KnowledgeStatus, next: KnowledgeStatus): void {
  if (!transitions[current].includes(next)) throw new Error("Invalid assertion transition");
}

export async function createKnowledgeAssertion(input: { idempotencyKey: string; subjectType: string; subjectId: string; predicate: string; value: object; scope: KnowledgeScope; companyId?: string; projectId?: string; confidence: KnowledgeConfidence; sourceId?: string; evidenceId?: string; reviewFindingId?: string; reviewDecisionId?: string; createdById: string }) {
  if (input.scope !== "GLOBAL") {
    if (!input.companyId) throw new Error("companyId is required for assertion scope");
    await assertWorkspaceMembership({ userId: input.createdById, companyId: input.companyId, minimumRole: "EDITOR" });
  }
  return prisma.knowledgeAssertion.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: { ...input, status: "OBSERVED" },
    update: {},
  });
}

export async function transitionKnowledgeAssertion(input: { assertionId: string; nextStatus: KnowledgeStatus; actorUserId: string; companyId: string; projectId?: string; rejectionReason?: string; correlationId?: string; allowGlobalPromotion?: boolean }) {
  if (!input.actorUserId.trim()) throw new Error("actor is required");
  await assertWorkspaceMembership({ userId: input.actorUserId, companyId: input.companyId, minimumRole: "EDITOR" });
  const current = await prisma.knowledgeAssertion.findUnique({ where: { id: input.assertionId }, select: { id: true, status: true, scope: true, companyId: true, projectId: true, sourceId: true, evidenceId: true } });
  if (!current || current.companyId !== input.companyId || (input.projectId !== undefined && current.projectId !== input.projectId)) throw new Error("Knowledge tenant access denied");
  assertAssertionTransition(current.status, input.nextStatus);
  if ((input.nextStatus === "REJECTED" || input.nextStatus === "DEPRECATED") && !input.rejectionReason?.trim()) throw new Error("reason/rejectionReason is required for this transition");
  if (["CONFIRMED", "VERIFIED", "CANONICAL"].includes(input.nextStatus) && (!current.sourceId || !current.evidenceId)) throw new Error("Assertion provenance is required for this transition");
  if (!input.correlationId?.trim()) throw new Error("correlationId is required for assertion transitions");
  if (input.nextStatus === "CANONICAL" && !input.allowGlobalPromotion) throw new Error("Explicit GLOBAL promotion authorization is required");
  const promotedGlobal = input.nextStatus === "CANONICAL" && input.allowGlobalPromotion === true;
  const updated = await prisma.knowledgeAssertion.update({ where: { id: input.assertionId }, data: { status: input.nextStatus, updatedById: input.actorUserId, rejectionReason: input.rejectionReason, ...(promotedGlobal ? { scope: "GLOBAL", companyId: null, projectId: null } : {}) } });
  await recordKnowledgeEvent({ eventType: "KNOWLEDGE_ASSERTION_TRANSITION", scope: promotedGlobal ? "GLOBAL" : current.scope, companyId: promotedGlobal ? undefined : input.companyId, projectId: promotedGlobal ? undefined : current.projectId ?? undefined, userId: input.actorUserId, entityType: "KnowledgeAssertion", entityId: current.id, sourceType: "KNOWLEDGE_ASSERTION_LIFECYCLE", sourceId: current.sourceId ?? undefined, evidenceId: current.evidenceId ?? undefined, previousValue: { status: current.status }, newValue: { status: input.nextStatus, scope: promotedGlobal ? "GLOBAL" : current.scope }, metadata: { correlationId: input.correlationId, previousStatus: current.status, nextStatus: input.nextStatus, ...(input.rejectionReason ? { reason: input.rejectionReason } : {}) }, idempotencyKey: `assertion-transition:${current.id}:${current.status}:${input.nextStatus}:${input.correlationId}` });
  if (promotedGlobal) logKnowledgeOperation({ stage: "promotion", outcome: "success", correlationId: input.correlationId, companyId: input.companyId, projectId: input.projectId, idempotencyKey: `assertion-transition:${current.id}:${current.status}:${input.nextStatus}:${input.correlationId}`, metadata: { assertionId: current.id, fromScope: current.scope, toScope: "GLOBAL" } });
  return updated;
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
