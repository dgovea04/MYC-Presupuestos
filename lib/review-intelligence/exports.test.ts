import { describe, expect, it } from "vitest";
import { buildReviewSummaryExport } from "./exports";

describe("review summary export", () => {
  it("keeps deterministic order, decimal strings, and escaped CSV values", () => {
    const result = buildReviewSummaryExport({
      run: { id: "run-1", status: "COMPLETED", createdAt: "2026-09-01T00:00:00.000Z", rulesVersion: "v1" },
      metrics: { totalFindings: 2, pendingFindings: 1 },
      findings: [
        { id: "b", budgetItemCode: "02", description: "Concreto, f\"c\"", findingType: "UNIT_INCONSISTENCY", status: "PENDING", priority: "0.900000", potentialImpact: "100.250000", evidenceSource: "spec.csv", evidenceLocation: "row 4" },
        { id: "a", budgetItemCode: "01", description: "Acero", findingType: "QUANTITY_MISMATCH", status: "RESOLVED", priority: "0.500000", potentialImpact: null, evidenceSource: "metrado.csv", evidenceLocation: "row 2" },
      ],
    });
    expect(result.json.findings.map((finding) => finding.id)).toEqual(["a", "b"]);
    expect(result.csv.split("\n")[0]).toBe("finding_id,budget_item_code,description,finding_type,status,priority,potential_impact,evidence_source,evidence_location");
    expect(result.csv).toContain('b,02,"Concreto, f""c""",UNIT_INCONSISTENCY,PENDING,0.900000,100.250000,spec.csv,row 4');
  });
});
