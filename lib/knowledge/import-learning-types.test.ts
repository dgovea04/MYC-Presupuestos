import { describe, expect, it } from "vitest";
import { buildImportLearningIdempotencyKey, parseImportLearningBatch, validateImportLearningBatch } from "./import-learning-types";

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

  it("parses persisted JSON payloads and rejects malformed payloads", () => {
    const parsed = parseImportLearningBatch({
      importId: "import-2",
      sourceType: "MCP_IMPORT",
      sourceLabel: "package.zip",
      companyId: "company-1",
      projectId: "project-1",
      createdById: "user-1",
      observedAt: "2026-09-11T10:00:00.000Z",
      observations: [{
        domain: "ITEM",
        originalRecordId: "item-1",
        value: { description: "Cemento" },
        confidence: "HIGH",
        evidence: { originalRecordId: "item-1", fileName: "package.zip" },
      }],
    });
    expect(parsed.observedAt).toEqual(new Date("2026-09-11T10:00:00.000Z"));
    expect(() => parseImportLearningBatch({ importId: "import-2", sourceType: "INVALID_IMPORT", sourceLabel: "x", companyId: "c", projectId: "p", createdById: "u", observations: [] })).toThrow("SOURCE_TYPE");
    expect(() => parseImportLearningBatch({ importId: "import-2", sourceType: "MCP_IMPORT", sourceLabel: "x", companyId: "c", projectId: "p", createdById: "u", observations: "invalid" })).toThrow("OBSERVATIONS");
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
