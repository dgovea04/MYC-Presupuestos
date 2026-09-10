import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichReviewResult } from "./review-enrichment";

afterEach(() => vi.unstubAllEnvs());

const baseline = { findingId: "f1", findingType: "YIELD_MISMATCH", comparison: { documentValue: "0.8", budgetValue: "1" }, evidenceUrl: "/api/review-evidence/e1/view" };

describe("review enrichment", () => {
  it("returns the unchanged baseline when enrichment is disabled", async () => {
    vi.stubEnv("MC_KNOWLEDGE_REVIEW_ENRICHMENT", "false");
    await expect(enrichReviewResult(baseline, { companyId: "c1", projectId: "p1", query: "cemento" })).resolves.toMatchObject({ baseline, knowledge: [], telemetry: { enabled: false, fallback: false } });
  });

  it("adds deterministic provenance without changing the baseline", async () => {
    vi.stubEnv("MC_KNOWLEDGE_REVIEW_ENRICHMENT", "true");
    const result = await enrichReviewResult(baseline, { companyId: "c1", projectId: "p1", query: "cemento" }, async () => ({ items: [{ id: "i1", scope: "PROJECT", confidence: "HIGH", evidenceId: "ke1", observedAt: "2026-09-09" }], resources: [], prices: [], yields: [], apuVersions: [], assertions: [] }));
    expect(result.baseline).toEqual(baseline);
    expect(result.knowledge).toEqual([{ id: "i1", scope: "PROJECT", confidence: "HIGH", observedAt: "2026-09-09", evidenceId: "ke1" }]);
    expect(result.telemetry).toMatchObject({ enabled: true, fallback: false });
  });

  it("falls back to the unchanged baseline when retrieval fails or exceeds the timeout", async () => {
    vi.stubEnv("MC_KNOWLEDGE_REVIEW_ENRICHMENT", "true");
    const result = await enrichReviewResult(baseline, { companyId: "c1", projectId: "p1", query: "cemento" }, async () => { throw new Error("retrieval unavailable"); });
    expect(result.baseline).toEqual(baseline);
    expect(result.knowledge).toEqual([]);
    expect(result.telemetry).toMatchObject({ enabled: true, fallback: true, error: "retrieval unavailable" });
  });
});
