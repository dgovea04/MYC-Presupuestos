import { describe, expect, it } from "vitest";
import { buildImportLearningIdempotencyKey, validateImportLearningBatch } from "./import-learning-types";

describe("import learning contract", () => {
  it("requires evidence and preserves decimal strings", () => {
    const batch = {
      importId: "import-1",
      sourceType: "S10_IMPORT" as const,
      sourceLabel: "presupuesto.json",
      companyId: "company-1",
      projectId: "project-1",
      createdById: "user-1",
      observations: [{
        domain: "PRICE" as const,
        originalRecordId: "resource-1",
        value: { value: "12.345678901234567890" },
        unit: "bolsa",
        confidence: "HIGH" as const,
        evidence: { originalRecordId: "resource-1", fileName: "presupuesto.json" },
      }],
    };

    expect(() => validateImportLearningBatch(batch)).not.toThrow();
    expect(batch.observations[0]?.value.value).toBe("12.345678901234567890");
    expect(buildImportLearningIdempotencyKey("import-1", "PRICE", "resource-1")).toBe("import-learning:import-1:PRICE:resource-1");
  });

  it("rejects observations without an origin identifier", () => {
    expect(() => validateImportLearningBatch({
      importId: "import-1",
      sourceType: "PDF_IMPORT",
      sourceLabel: "scan.pdf",
      companyId: "company-1",
      projectId: "project-1",
      createdById: "user-1",
      observations: [{
        domain: "ITEM",
        originalRecordId: " ",
        value: { name: "Cemento" },
        confidence: "MEDIUM",
        evidence: { originalRecordId: "row-1" },
      }],
    })).toThrow("originalRecordId");
  });
});
