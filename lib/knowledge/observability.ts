export type KnowledgeStage = "bridge" | "enrichment" | "retry" | "backfill" | "provenance" | "promotion";
export type KnowledgeOutcome = "success" | "failure" | "retry" | "skip";
export type KnowledgeLog = { stage: KnowledgeStage; outcome: KnowledgeOutcome; correlationId: string; companyId?: string; projectId?: string; findingId?: string; decisionId?: string; idempotencyKey?: string; durationMs?: number; errorCode?: string; retryCount?: number; metadata?: Record<string, unknown> };

const counters = new Map<string, number>();

export function logKnowledgeOperation(entry: KnowledgeLog): void {
  const key = `knowledge.${entry.stage}.${entry.outcome}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
  console.info(JSON.stringify({ event: "knowledge_operation", ...entry, metric: key }));
}

export function getKnowledgeMetrics(): Record<string, number> {
  return Object.fromEntries(counters.entries());
}

export function resetKnowledgeMetrics(): void {
  counters.clear();
}
