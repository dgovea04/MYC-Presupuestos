type BackfillResource = { id: string; description: string; unit: string | null; companyId: string | null };
export type KnowledgeBackfillCandidate = { idempotencyKey: string; name: string; canonicalUnit?: string; companyId: string; status: "OBSERVED" };
type MigrationProvenanceCounter = { sources: number; evidence: number };
export type MigrationProvenanceReport = { candidates: MigrationProvenanceCounter; created: MigrationProvenanceCounter; skipped: MigrationProvenanceCounter };

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

export function buildKnowledgeBackfillPlan(rows: readonly BackfillResource[], options: { companyId?: string; dryRun?: boolean } = {}): KnowledgeBackfillCandidate[] {
  return rows.flatMap((row) => {
    if (!row.companyId || (options.companyId && row.companyId !== options.companyId) || !row.description.trim()) return [];
    return [{ idempotencyKey: `backfill:resource:${row.id}`, name: row.description.trim(), ...(row.unit ? { canonicalUnit: row.unit.trim() } : {}), companyId: row.companyId, status: "OBSERVED" as const }];
  });
}
