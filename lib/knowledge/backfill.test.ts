import { describe, expect, it } from "vitest";
import { buildCanonicalResourceLookupIndex } from "./canonical-resources";
import { buildKnowledgeBackfillPlan, buildMigrationEvidenceKey, buildMigrationSourceKey, recordMigrationProvenanceOutcome, resolveBackfillCanonicalResource, summarizeBackfillApuResourceResolutions } from "./backfill";

describe("knowledge backfill planner", () => {
  it("creates observed, deterministic candidates without inventing provenance", () => {
    const plan = buildKnowledgeBackfillPlan([{ id: "r1", description: "Cemento Portland", unit: "bolsa", companyId: "c1" }], { companyId: "c1" });
    expect(plan).toEqual([{ idempotencyKey: "backfill:resource:r1", name: "Cemento Portland", canonicalUnit: "bolsa", companyId: "c1", status: "OBSERVED" }]);
  });

  it("supports dry-run without changing candidate semantics", () => {
    const plan = buildKnowledgeBackfillPlan([{ id: "r1", description: "Arena", unit: null, companyId: "c2" }], { companyId: "c1", dryRun: true });
    expect(plan).toEqual([]);
  });

  it("builds stable migration source and evidence keys without timestamp identity", () => {
    const sourceKey = buildMigrationSourceKey({ companyId: "c1", projectId: "p1", correlationId: "knowledge-backfill:c1:p1" });

    expect(sourceKey).toBe("migration:c1:p1:knowledge-backfill:c1:p1");
    expect(buildMigrationEvidenceKey({ sourceKey, domain: "resource", sourceRecordId: "r1" })).toBe("migration:c1:p1:knowledge-backfill:c1:p1:evidence:resource:r1");
  });

  it("counts dry-run provenance candidates as skipped without writes", () => {
    const report = { candidates: { sources: 0, evidence: 0 }, created: { sources: 0, evidence: 0 }, skipped: { sources: 0, evidence: 0 } };

    recordMigrationProvenanceOutcome(report, { source: "skipped", evidence: "skipped" });
    recordMigrationProvenanceOutcome(report, { source: "skipped", evidence: "skipped" });

    expect(report).toEqual({ candidates: { sources: 2, evidence: 2 }, created: { sources: 0, evidence: 0 }, skipped: { sources: 2, evidence: 2 } });
  });
});

describe("backfill canonical resource resolution", () => {
  it("matches a normalized canonical name with a compatible unit", () => {
    const index = buildCanonicalResourceLookupIndex([
      { id: "canonical-cement", normalizedName: "cemento portland tipo i", canonicalUnit: "BOL", scope: "COMPANY", companyId: "c1", aliases: [] },
    ]);

    expect(resolveBackfillCanonicalResource({ resourceId: "resource-cement", description: "  CEMENTO PORTLAND TIPO I ", unit: "bolsa", companyId: "c1" }, index)).toEqual({ kind: "matched", canonicalResourceId: "canonical-cement" });
  });

  it("matches a normalized alias with a compatible unit", () => {
    const index = buildCanonicalResourceLookupIndex([
      { id: "canonical-sand", normalizedName: "arena gruesa", canonicalUnit: "M3", scope: "COMPANY", companyId: "c1", aliases: [{ normalizedAlias: "arena de rio" }] },
    ]);

    expect(resolveBackfillCanonicalResource({ resourceId: "resource-sand", description: "Arena de Rio", unit: "m3", companyId: "c1" }, index)).toEqual({ kind: "matched", canonicalResourceId: "canonical-sand" });
  });

  it("skips an APU resource without a canonical candidate", () => {
    const index = buildCanonicalResourceLookupIndex([
      { id: "canonical-cement", normalizedName: "cemento", canonicalUnit: "BOL", scope: "COMPANY", companyId: "c1", aliases: [] },
    ]);

    expect(resolveBackfillCanonicalResource({ resourceId: "resource-steel", description: "Acero corrugado", unit: "kg", companyId: "c1" }, index)).toEqual({ kind: "skipped", reason: "NO_MATCH" });
  });

  it("skips an ambiguous APU resource instead of selecting the first candidate", () => {
    const index = buildCanonicalResourceLookupIndex([
      { id: "canonical-cement-a", normalizedName: "cemento", canonicalUnit: "BOL", scope: "COMPANY", companyId: "c1", aliases: [] },
      { id: "canonical-cement-b", normalizedName: "cemento", canonicalUnit: "BOL", scope: "COMPANY", companyId: "c1", aliases: [] },
    ]);

    expect(resolveBackfillCanonicalResource({ resourceId: "resource-cement", description: "Cemento", unit: "bolsa", companyId: "c1" }, index)).toEqual({ kind: "skipped", reason: "AMBIGUOUS" });
  });

  it("returns the canonical resource ID and never the operational Resource ID", () => {
    const index = buildCanonicalResourceLookupIndex([
      { id: "canonical-cement", normalizedName: "cemento", canonicalUnit: "KG", scope: "COMPANY", companyId: "c1", aliases: [] },
    ]);

    const result = resolveBackfillCanonicalResource({ resourceId: "resource-cement", description: "Cemento", unit: "kg", companyId: "c1" }, index);

    expect(result).toEqual({ kind: "matched", canonicalResourceId: "canonical-cement" });
    expect(result).not.toEqual(expect.objectContaining({ canonicalResourceId: "resource-cement" }));
  });
});

describe("backfill APU resource resolution reporting", () => {
  it("keeps matched rows separate from unresolved row conflicts", () => {
    expect(summarizeBackfillApuResourceResolutions([
      { resourceId: "operational-cement", resolution: { kind: "matched", canonicalResourceId: "canonical-cement" } },
      { resourceId: "operational-steel", resolution: { kind: "skipped", reason: "NO_MATCH" } },
      { resourceId: null, resolution: { kind: "skipped", reason: "AMBIGUOUS" } },
    ])).toEqual({
      matched: 1,
      skipped: 2,
      conflicts: [
        { resourceId: "operational-steel", reason: "NO_MATCH" },
        { resourceId: null, reason: "AMBIGUOUS" },
      ],
    });
  });
});
