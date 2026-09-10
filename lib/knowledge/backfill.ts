type BackfillResource = { id: string; description: string; unit: string | null; companyId: string | null };
export type KnowledgeBackfillCandidate = { idempotencyKey: string; name: string; canonicalUnit?: string; companyId: string; status: "OBSERVED" };

export function buildKnowledgeBackfillPlan(rows: readonly BackfillResource[], options: { companyId?: string; dryRun?: boolean } = {}): KnowledgeBackfillCandidate[] {
  return rows.flatMap((row) => {
    if (!row.companyId || (options.companyId && row.companyId !== options.companyId) || !row.description.trim()) return [];
    return [{ idempotencyKey: `backfill:resource:${row.id}`, name: row.description.trim(), ...(row.unit ? { canonicalUnit: row.unit.trim() } : {}), companyId: row.companyId, status: "OBSERVED" as const }];
  });
}
