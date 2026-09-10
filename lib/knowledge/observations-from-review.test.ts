import { describe, expect, it } from "vitest";
import { buildReviewObservations } from "./observations-from-review";

const base = { findingId: "f1", decisionId: "d1", companyId: "c1", projectId: "p1", sourceId: "s1", evidenceId: "e1", observedAt: new Date("2026-09-09"), confidence: "HIGH" as const };

describe("review observation builders", () => {
  it("builds a project yield observation from a confirmed finding", () => {
    const result = buildReviewObservations({ ...base, resolution: "CONFIRMED_ISSUE", findingType: "YIELD_MISMATCH", canonicalItemId: "item-1", comparison: { documentValue: "0.80", unit: "m3" } });
    expect(result.observations).toEqual([expect.objectContaining({ canonicalItemId: "item-1", value: "0.80", unit: "m3", scope: "PROJECT", companyId: "c1", projectId: "p1", idempotencyKey: "review-yield:d1" })]);
  });

  it("does not create an observation for a false positive", () => {
    const result = buildReviewObservations({ ...base, resolution: "FALSE_POSITIVE", findingType: "YIELD_MISMATCH", canonicalItemId: "item-1", comparison: { documentValue: "0.80", unit: "m3" } });
    expect(result.observations).toEqual([]);
    expect(result.skipReasons).toContain("RESOLUTION_NOT_ELIGIBLE");
  });

  it("reports missing structured evidence without inventing values", () => {
    const result = buildReviewObservations({ ...base, resolution: "CONFIRMED_ISSUE", findingType: "YIELD_MISMATCH", canonicalItemId: "item-1", comparison: { unit: "m3" } });
    expect(result.observations).toEqual([]);
    expect(result.skipReasons).toContain("MISSING_DOCUMENT_VALUE");
  });

  it("builds a corrected APU only with explicit before and after snapshots", () => {
    const result = buildReviewObservations({ ...base, resolution: "CORRECTED", findingType: "INCOMPLETE_APU", comparison: {}, correctionVersionId: "version-2", apuBefore: { apuId: "apu-1", name: "Concreto", unit: "M3", performance: "8", scope: "PROJECT", companyId: "c1", projectId: "p1", resources: [] }, apuAfter: { apuId: "apu-1", name: "Concreto", unit: "M3", performance: "7", scope: "PROJECT", companyId: "c1", projectId: "p1", resources: [] } });
    expect(result.observations).toEqual([]);
    expect(result.apuCorrections).toHaveLength(1);
    expect(result.apuCorrections[0]).toEqual(expect.objectContaining({ idempotencyKey: "review-apu:d1:version-2" }));
  });

  it("skips corrected APU without complete provenance snapshots", () => {
    const result = buildReviewObservations({ ...base, resolution: "CORRECTED", findingType: "INCOMPLETE_APU", comparison: {}, correctionVersionId: "version-2" });
    expect(result.apuCorrections).toEqual([]);
    expect(result.skipReasons).toContain("MISSING_APU_SNAPSHOT");
  });
});
