import { describe, expect, it } from "vitest";
import { buildKnowledgeBackfillPlan, buildMigrationEvidenceKey, buildMigrationSourceKey } from "./backfill";

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
});
