import { describe, expect, it } from "vitest";
import { compareReviewRuns } from "./run-comparison";

describe("review run comparison", () => {
  it("classifies new, persistent, resolved, and changed findings", () => {
    const result = compareReviewRuns({
      baseRun: { id: "base", status: "COMPLETED", metrics: { failures: 3 } },
      compareRun: { id: "next", status: "COMPLETED", metrics: { failures: 2 } },
      baseFindings: [
        { budgetItemId: "item-1", findingType: "QUANTITY_MISMATCH", evidenceId: "ev-1", status: "PENDING", comparison: { difference: "1" } },
        { budgetItemId: "item-2", findingType: "UNIT_INCONSISTENCY", evidenceId: "ev-2", status: "RESOLVED", comparison: {} },
        { budgetItemId: "item-4", findingType: "UNIT_INCONSISTENCY", evidenceId: "ev-4", status: "PENDING", comparison: {} },
      ],
      compareFindings: [
        { budgetItemId: "item-1", findingType: "QUANTITY_MISMATCH", evidenceId: "ev-1", status: "PENDING", comparison: { difference: "2" } },
        { budgetItemId: "item-4", findingType: "UNIT_INCONSISTENCY", evidenceId: "ev-4", status: "PENDING", comparison: {} },
        { budgetItemId: "item-3", findingType: "INCOMPLETE_APU", evidenceId: "ev-3", status: "PENDING", comparison: {} },
      ],
    });
    expect(result.summary).toEqual({ new: 1, persistent: 1, resolved: 1, changed: 1 });
    expect(result.findings.map((finding) => finding.classification)).toEqual(["CHANGED", "NEW", "PERSISTENT", "RESOLVED"]);
  });
});
