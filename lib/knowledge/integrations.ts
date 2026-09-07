import { recordKnowledgeEvent } from "./events";

export async function recordImportKnowledgeEvent(input: { userId: string; companyId: string; projectId: string; budgetId: string; sourceType: string; sourceId?: string }) {
  return recordKnowledgeEvent({ eventType: "IMPORT_COMPLETED", scope: "PROJECT", companyId: input.companyId, projectId: input.projectId, userId: input.userId, entityType: "Budget", entityId: input.budgetId, sourceType: input.sourceType, sourceId: input.sourceId, idempotencyKey: `import:${input.sourceType}:${input.budgetId}` });
}

export async function recordReviewDecisionKnowledgeEvent(input: { userId: string; companyId: string; projectId: string; findingId: string; resolution: string }) {
  return recordKnowledgeEvent({ eventType: input.resolution === "CONFIRMED_ISSUE" ? "REVIEW_ISSUE_CONFIRMED" : "REVIEW_ISSUE_REJECTED", scope: "PROJECT", companyId: input.companyId, projectId: input.projectId, userId: input.userId, entityType: "ReviewFinding", entityId: input.findingId, sourceType: "MC_REVISOR", newValue: { resolution: input.resolution }, idempotencyKey: `review-decision:${input.findingId}:${input.resolution}` });
}

