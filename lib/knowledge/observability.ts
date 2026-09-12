export type KnowledgeStage = "bridge" | "enrichment" | "retry" | "backfill" | "provenance" | "promotion";
export type KnowledgeOutcome = "success" | "failure" | "retry" | "skip";
export type KnowledgeLog = { stage: KnowledgeStage; outcome: KnowledgeOutcome; correlationId: string; companyId?: string; projectId?: string; findingId?: string; decisionId?: string; idempotencyKey?: string; durationMs?: number; errorCode?: string; retryCount?: number; metadata?: Record<string, unknown> };

const counters = new Map<string, number>();

export function logKnowledgeOperation(entry: KnowledgeLog): void {
  const key = `knowledge.${entry.stage}.${entry.outcome}`;
  increment(key);
  if (entry.stage === "bridge" && entry.metadata) {
    incrementBy("knowledge.bridge.created", readCount(entry.metadata.created));
    incrementBy("knowledge.bridge.skipped", readCount(entry.metadata.skipped));
    incrementBy("knowledge.bridge.conflicts", readCount(entry.metadata.conflicts));
  }
  const persistentMetrics = (prisma as unknown as { knowledgeMetricEvent?: { upsert: (args: unknown) => Promise<unknown> } }).knowledgeMetricEvent;
  if (entry.idempotencyKey && persistentMetrics) {
    void persistentMetrics.upsert({
      where: { idempotencyKey: entry.idempotencyKey },
      create: {
        metric: key,
        stage: entry.stage,
        outcome: entry.outcome,
        correlationId: entry.correlationId,
        companyId: entry.companyId,
        projectId: entry.projectId,
        findingId: entry.findingId,
        decisionId: entry.decisionId,
        idempotencyKey: entry.idempotencyKey,
        durationMs: entry.durationMs,
        retryCount: entry.retryCount,
        errorCode: entry.errorCode,
        metadata: entry.metadata === undefined ? undefined : JSON.parse(JSON.stringify(entry.metadata)) as Prisma.InputJsonValue,
      },
      update: {},
    }).catch(() => undefined);
  }
  console.info(JSON.stringify({ event: "knowledge_operation", ...entry, metric: key }));
}

function readCount(value: unknown): number { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0; }
function increment(key: string): void { incrementBy(key, 1); }
function incrementBy(key: string, amount: number): void { if (amount > 0) counters.set(key, (counters.get(key) ?? 0) + amount); }

export function getKnowledgeMetrics(): Record<string, number> {
  return Object.fromEntries(counters.entries());
}

export function resetKnowledgeMetrics(): void {
  counters.clear();
}
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
