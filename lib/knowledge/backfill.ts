import { lookupCanonicalResourceCandidates, type CanonicalResourceLookupIndex } from "./canonical-resources";
import { normalizeKnowledgeText, normalizeKnowledgeUnit } from "./normalization";

type BackfillResource = { id: string; description: string; unit: string | null; companyId: string | null };
export type KnowledgeBackfillCandidate = { idempotencyKey: string; name: string; canonicalUnit?: string; companyId: string; status: "OBSERVED" };
type MigrationProvenanceCounter = { sources: number; evidence: number };
export type MigrationProvenanceReport = { candidates: MigrationProvenanceCounter; created: MigrationProvenanceCounter; skipped: MigrationProvenanceCounter };
export type BackfillCanonicalResourceInput = { resourceId: string | null; description: string; unit: string; companyId: string };
export type BackfillCanonicalResourceResolution = { kind: "matched"; canonicalResourceId: string } | { kind: "skipped"; reason: "NO_MATCH" | "AMBIGUOUS" };
export type BackfillApuResourceResolutionSummary = {
  matched: number;
  skipped: number;
  conflicts: Array<{ resourceId: string | null; reason: "NO_MATCH" | "AMBIGUOUS" }>;
};

export function recordMigrationProvenanceOutcome(report: MigrationProvenanceReport, outcome: { source: "created" | "skipped"; evidence: "created" | "skipped" }): void {
  report.candidates.sources++;
  report.candidates.evidence++;
  report[outcome.source].sources++;
  report[outcome.evidence].evidence++;
}

export function buildMigrationSourceKey(input: { companyId: string; projectId?: string; correlationId: string }): string {
  return `migration:${input.companyId}:${input.projectId ?? "company"}:${input.correlationId}`;
}

export function buildMigrationEvidenceKey(input: { sourceKey: string; domain: string; sourceRecordId: string }): string {
  return `${input.sourceKey}:evidence:${input.domain}:${input.sourceRecordId}`;
}

export function resolveBackfillCanonicalResource(input: BackfillCanonicalResourceInput, index: CanonicalResourceLookupIndex): BackfillCanonicalResourceResolution {
  const normalizedUnit = normalizeKnowledgeUnit(input.unit);
  const compatibleCandidates = lookupCanonicalResourceCandidates(index, normalizeKnowledgeText(input.description)).filter((candidate) => {
    const belongsToTenant = candidate.scope === "GLOBAL" || candidate.companyId === input.companyId;
    const hasCompatibleUnit = !candidate.canonicalUnit || normalizeKnowledgeUnit(candidate.canonicalUnit) === normalizedUnit;
    return belongsToTenant && hasCompatibleUnit;
  });
  if (compatibleCandidates.length === 0) return { kind: "skipped", reason: "NO_MATCH" };
  if (compatibleCandidates.length > 1) return { kind: "skipped", reason: "AMBIGUOUS" };
  const candidate = compatibleCandidates[0];
  if (!candidate) return { kind: "skipped", reason: "NO_MATCH" };
  return { kind: "matched", canonicalResourceId: candidate.id };
}

export function summarizeBackfillApuResourceResolutions(rows: readonly { resourceId: string | null; resolution: BackfillCanonicalResourceResolution }[]): BackfillApuResourceResolutionSummary {
  let matched = 0;
  let skipped = 0;
  const conflicts: BackfillApuResourceResolutionSummary["conflicts"] = [];
  for (const row of rows) {
    if (row.resolution.kind === "matched") {
      matched++;
      continue;
    }
    skipped++;
    conflicts.push({ resourceId: row.resourceId, reason: row.resolution.reason });
  }
  return { matched, skipped, conflicts };
}

export function buildKnowledgeBackfillPlan(rows: readonly BackfillResource[], options: { companyId?: string; dryRun?: boolean } = {}): KnowledgeBackfillCandidate[] {
  return rows.flatMap((row) => {
    if (!row.companyId || (options.companyId && row.companyId !== options.companyId) || !row.description.trim()) return [];
    return [{ idempotencyKey: `backfill:resource:${row.id}`, name: row.description.trim(), ...(row.unit ? { canonicalUnit: row.unit.trim() } : {}), companyId: row.companyId, status: "OBSERVED" as const }];
  });
}
