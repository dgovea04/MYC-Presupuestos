import { describe, expect, it } from "vitest";
import { calculateReviewRunMetrics } from "./metrics";

describe("calculateReviewRunMetrics", () => {
  it("cuenta cobertura por categoría y fuentes parcialmente extraídas sin afectar la cobertura global", () => {
    const result = calculateReviewRunMetrics({
      budgetIds: ["budget-1"],
      budgetItems: [{ id: "item-1", budgetId: "budget-1" }],
      evidence: [
        { id: "quantity", documentVersionId: "version-partial", evidenceType: "QUANTITY", unit: "m3", metadataJson: { technicalSpec: "Concreto f'c 210", apuComponents: ["cemento", "arena"] } },
        { id: "unit", documentVersionId: "version-partial", evidenceType: "UNIT", unit: "kg", metadataJson: {} },
        { id: "specification", documentVersionId: "version-failed", evidenceType: "TECHNICAL_SPECIFICATION", metadataJson: { technicalSpec: "  Acero ASTM A615  " } },
        { id: "component", documentVersionId: "version-complete", evidenceType: "APU_COMPONENT", metadataJson: { apuComponents: ["mano de obra"] } },
        { id: "yield", documentVersionId: "version-complete", evidenceType: "OTHER", metadataJson: { yield: "2.500" } },
        { id: "empty", documentVersionId: "version-complete", evidenceType: "OTHER", unit: "  ", metadataJson: { technicalSpec: " ", apuComponents: [], yield: "not-a-decimal" } },
      ],
      documentVersions: [
        { id: "version-partial", extractionCoverage: [{ coverage: "OCR_REQUIRED" }, { coverage: "OCR_REQUIRED" }] },
        { id: "version-failed", extractionCoverage: [{ coverage: "FAILED" }] },
        { id: "version-complete", extractionCoverage: [{ coverage: "PROCESSED" }] },
      ],
      links: [{ budgetItemId: "item-1", evidenceId: "quantity" }],
      findings: [],
      warnings: [{ code: "EXTRACTION_PARTIAL", message: "partial extraction" }],
    });

    expect(result.coverageByCategory).toEqual({ quantity: 1, unit: 2, specification: 2, apuComponent: 2, yield: 1 });
    expect(result.partiallyCoveredSources).toBe(2);
    expect(result.coveragePercent).toBe(100);
    expect(result.incompleteness).toBe(1);
  });

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
    expect(result).toEqual({ analyzedItems: 3, totalItems: 3, coveragePercent: 33, evidenceCount: 2, linkedEvidenceCount: 1, findingsByStatus: { PENDING: 1, RESOLVED: 1 }, findingsByType: { QUANTITY_MISMATCH: 1, INCOMPLETE_APU: 1 }, failures: 0, incompleteness: 2, deltaVsPrevious: 2 });
  });
});
