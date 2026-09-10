import { isKnowledgeFeatureEnabled } from "./feature-flags";
import { retrieveKnowledgeV1, type RetrievalV1Input, type RetrievalV1Result } from "./retrieval-v1";
import { logKnowledgeOperation } from "./observability";

type ReviewBaseline = Record<string, unknown>;
export type KnowledgeSignal = { id: string; scope: string; confidence?: string; observedAt?: string; evidenceId?: string; provenance?: Record<string, unknown> };
type Retrieval = (input: RetrievalV1Input) => Promise<RetrievalV1Result>;
type EnrichmentTelemetry = { enabled: boolean; fallback: boolean; latencyMs: number; error?: string };
const ENRICHMENT_TIMEOUT_MS = 1500;

export async function enrichReviewResult(baseline: ReviewBaseline, input: RetrievalV1Input, retrieve: Retrieval = retrieveKnowledgeV1, onTelemetry: (telemetry: EnrichmentTelemetry) => void = (telemetry) => console.info("review_knowledge_enrichment", telemetry)): Promise<{ baseline: ReviewBaseline; knowledge: KnowledgeSignal[]; telemetry: EnrichmentTelemetry }> {
  const startedAt = performance.now();
  if (!isKnowledgeFeatureEnabled("reviewEnrichment") || !isKnowledgeFeatureEnabled("retrievalV1", input)) {
    const telemetry = { enabled: false, fallback: false, latencyMs: Math.round(performance.now() - startedAt) };
    onTelemetry(telemetry);
    logKnowledgeOperation({ stage: "enrichment", outcome: "skip", correlationId: input.correlationId ?? `review-enrichment:${input.companyId}:${input.projectId ?? "none"}`, companyId: input.companyId, projectId: input.projectId, durationMs: telemetry.latencyMs, metadata: { reason: !isKnowledgeFeatureEnabled("reviewEnrichment") ? "FEATURE_DISABLED" : "RETRIEVAL_DISABLED" } });
    return { baseline, knowledge: [], telemetry };
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let result: RetrievalV1Result;
  try {
    result = await Promise.race([
      retrieve(input),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Knowledge enrichment timeout")), ENRICHMENT_TIMEOUT_MS); }),
    ]);
  } catch (error) {
    const telemetry = { enabled: true, fallback: true, latencyMs: Math.round(performance.now() - startedAt), error: error instanceof Error ? error.message : "Knowledge enrichment failed" };
    onTelemetry(telemetry);
    logKnowledgeOperation({ stage: "enrichment", outcome: "failure", correlationId: input.correlationId ?? `review-enrichment:${input.companyId}:${input.projectId ?? "none"}`, companyId: input.companyId, projectId: input.projectId, durationMs: telemetry.latencyMs, errorCode: "ENRICHMENT_FALLBACK", metadata: { error: telemetry.error } });
    return { baseline, knowledge: [], telemetry };
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
  const rows = [...result.items, ...result.resources, ...result.prices, ...result.yields, ...result.apuVersions, ...result.assertions];
  const knowledge = rows.flatMap((row) => typeof row.id === "string" && typeof row.scope === "string" ? [{ id: row.id, scope: row.scope, confidence: typeof row.confidence === "string" ? row.confidence : undefined, observedAt: typeof row.observedAt === "string" ? row.observedAt : undefined, evidenceId: typeof row.evidenceId === "string" ? row.evidenceId : undefined, ...(row.provenance && typeof row.provenance === "object" && !Array.isArray(row.provenance) ? { provenance: row.provenance as Record<string, unknown> } : {}) }] : []);
  const telemetry = { enabled: true, fallback: false, latencyMs: Math.round(performance.now() - startedAt) };
  onTelemetry(telemetry);
  logKnowledgeOperation({ stage: "enrichment", outcome: "success", correlationId: input.correlationId ?? `review-enrichment:${input.companyId}:${input.projectId ?? "none"}`, companyId: input.companyId, projectId: input.projectId, durationMs: telemetry.latencyMs, metadata: { resultCount: knowledge.length } });
  return { baseline, knowledge, telemetry };
}

export async function enrichPersistedReviewFinding(finding: ReviewBaseline, input: { companyId: string; projectId: string; correlationId?: string }, onTelemetry?: (telemetry: EnrichmentTelemetry) => void) {
  const budgetItem = finding.budgetItem;
  const query = budgetItem && typeof budgetItem === "object" && !Array.isArray(budgetItem) && typeof (budgetItem as Record<string, unknown>).description === "string" ? (budgetItem as Record<string, unknown>).description as string : "";
  if (!query) return { ...finding, knowledge: [], knowledgeTelemetry: { enabled: false, fallback: false, latencyMs: 0 } };
  const enriched = await enrichReviewResult(finding, { ...input, query }, undefined, onTelemetry);
  return { ...enriched.baseline, knowledge: enriched.knowledge, knowledgeTelemetry: enriched.telemetry };
}
