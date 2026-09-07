import { describe, expect, it } from "vitest";
import { buildIntegrationUpdates } from "./mapping";
import type { StagedIntegrationRow } from "./types";

describe("integration mapping", () => {
  it("maps compatible staged rows to explicit budget updates", () => {
    const rows: StagedIntegrationRow[] = [{
      externalKey: "MAT-01",
      internalCandidateId: "item-1",
      values: { description: "Cemento", unit: "bolsa", quantity: "2.5", unitPrice: "31.40" },
      provenance: { source: "source.xlsx", row: 4 },
    }];

    expect(buildIntegrationUpdates(rows)).toEqual({
      updates: [{ id: "item-1", description: "Cemento", unit: "bolsa", quantity: "2.5", unitPrice: "31.40" }],
      unresolved: [],
    });
  });

  it("does not apply rows without an internal candidate or with invalid numeric values", () => {
    const rows: StagedIntegrationRow[] = [{
      externalKey: "MAT-02",
      values: { description: "Arena", quantity: "no-num", unitPrice: "10" },
      provenance: { source: "source.xlsx", row: 5 },
    }];

    expect(buildIntegrationUpdates(rows)).toEqual({
      updates: [],
      unresolved: [{ externalKey: "MAT-02", reason: "UNRESOLVED_MAPPING" }],
    });
  });
});
