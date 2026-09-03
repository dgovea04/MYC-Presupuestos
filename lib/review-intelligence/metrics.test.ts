import { describe, expect, it } from "vitest";
import { calculateReviewRunMetrics } from "./metrics";

describe("calculateReviewRunMetrics", () => {
  it("agrega partidas del presupuesto padre e hijos y cobertura persistida", () => {
    const result = calculateReviewRunMetrics({
      budgetIds: ["parent", "child"],
      budgetItems: [{ id: "item-parent", budgetId: "parent" }, { id: "item-child", budgetId: "child" }, { id: "item-unreviewed", budgetId: "child" }],
      evidence: [{ id: "evidence-1", documentVersionId: "version-1" }, { id: "evidence-2", documentVersionId: "version-1" }],
      links: [{ budgetItemId: "item-child", evidenceId: "evidence-1" }],
      findings: [{ budgetItemId: "item-child", status: "PENDING", findingType: "QUANTITY_MISMATCH" }, { budgetItemId: "item-parent", status: "RESOLVED", findingType: "INCOMPLETE_APU" }],
      warnings: [{ code: "EXTRACTION_PARTIAL", message: "incomplete page" }],
      previous: { analyzedItems: 1, coveragePercent: 25, failures: 0, incompleteness: 0, deltaVsPrevious: null },
    });
    expect(result).toEqual({ analyzedItems: 2, totalItems: 3, coveragePercent: 67, evidenceCount: 2, linkedEvidenceCount: 1, findingsByStatus: { PENDING: 1, RESOLVED: 1 }, findingsByType: { QUANTITY_MISMATCH: 1, INCOMPLETE_APU: 1 }, failures: 0, incompleteness: 2, deltaVsPrevious: 1 });
  });
});
