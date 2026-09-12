import { describe, expect, it, vi } from "vitest";

const { source, evidence, assertion, priceObservation, itemFindMany, resourceFindMany } = vi.hoisted(() => ({
  source: { upsert: vi.fn().mockResolvedValue({ id: "source-1" }) },
  evidence: { upsert: vi.fn().mockResolvedValue({ id: "evidence-1" }) },
  assertion: { upsert: vi.fn().mockResolvedValue({ id: "assertion-1" }) },
  priceObservation: { upsert: vi.fn().mockResolvedValue({ id: "price-1" }) },
  itemFindMany: vi.fn().mockResolvedValue([]),
  resourceFindMany: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { knowledgeSource: source, knowledgeEvidence: evidence, knowledgeAssertion: assertion, priceObservation, canonicalItem: { findMany: itemFindMany }, canonicalResource: { findMany: resourceFindMany } } }));
vi.mock("./feature-flags", () => ({ isKnowledgeFeatureEnabled: vi.fn().mockReturnValue(true) }));

import { recordImportLearningBatch } from "./import-learning";

describe("import learning adapter", () => {
  it("creates project provenance and an observed assertion for a new entity", async () => {
    const result = await recordImportLearningBatch({
      importId: "import-1",
      sourceType: "S10_IMPORT",
      sourceLabel: "obra.json",
      companyId: "company-1",
      projectId: "project-1",
      createdById: "user-1",
      observations: [{ domain: "ITEM", originalRecordId: "item-1", name: "Concreto", value: { description: "Concreto" }, confidence: "HIGH", evidence: { originalRecordId: "item-1", fileName: "obra.json", page: "2" } }],
    });

    expect(result).toMatchObject({ sourceId: "source-1", created: 1, assertionIds: ["assertion-1"] });
    expect(source.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { idempotencyKey: "import-source:S10_IMPORT:import-1" } }));
    expect(evidence.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ sourceId: "source-1", projectId: "project-1", fileName: "obra.json" }) }));
    expect(assertion.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ scope: "PROJECT", status: "REVIEW_REQUIRED", evidenceId: "evidence-1" }) }));
  });

  it("blocks ambiguous resource prices and retains the evidence", async () => {
    resourceFindMany.mockResolvedValueOnce([{ id: "r1", canonicalUnit: "KG", scope: "GLOBAL", companyId: null }, { id: "r2", canonicalUnit: "KG", scope: "GLOBAL", companyId: null }]);
    const result = await recordImportLearningBatch({
      importId: "import-2",
      sourceType: "PDF_IMPORT",
      sourceLabel: "scan.pdf",
      companyId: "company-1",
      projectId: "project-1",
      createdById: "user-1",
      observations: [{ domain: "PRICE", originalRecordId: "row-8", value: { value: "12.345678" }, unit: "kg", currency: "PEN", confidence: "MEDIUM", entity: { domain: "RESOURCE", name: "Acero", unit: "KG" }, evidence: { originalRecordId: "row-8", fileName: "scan.pdf", page: "8" } }],
    });

    expect(result).toMatchObject({ created: 1, conflicts: [{ reason: "MULTIPLE_CANONICAL_MATCHES" }] });
    expect(assertion.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ create: expect.objectContaining({ status: "REVIEW_REQUIRED", value: expect.objectContaining({ conflict: "MULTIPLE_CANONICAL_MATCHES" }) }) }));
  });

  it("keeps independent rows processing when one row has a data error", async () => {
    assertion.upsert.mockRejectedValueOnce(new Error("ROW_DATA_INVALID"));
    const result = await recordImportLearningBatch({
      importId: "import-partial",
      sourceType: "S10_IMPORT",
      sourceLabel: "obra.json",
      companyId: "company-1",
      projectId: "project-1",
      createdById: "user-1",
      observations: [
        { domain: "ITEM", originalRecordId: "bad-row", name: "Fila inválida", value: { description: "Fila inválida" }, confidence: "LOW", evidence: { originalRecordId: "bad-row", fileName: "obra.json" } },
        { domain: "ITEM", originalRecordId: "good-row", name: "Concreto", value: { description: "Concreto" }, confidence: "HIGH", evidence: { originalRecordId: "good-row", fileName: "obra.json" } },
      ],
    });

    expect(result).toMatchObject({ created: 1, failed: [{ originalRecordId: "bad-row", reason: "ROW_DATA_INVALID" }] });
    expect(result.assertionIds).toEqual(["assertion-1"]);
  });

  it("propagates infrastructure failures so the integration job can retry", async () => {
    evidence.upsert.mockRejectedValueOnce(new Error("database connection unavailable"));
    await expect(recordImportLearningBatch({
      importId: "import-infra",
      sourceType: "PDF_IMPORT",
      sourceLabel: "scan.pdf",
      companyId: "company-1",
      projectId: "project-1",
      createdById: "user-1",
      observations: [{ domain: "ITEM", originalRecordId: "row-1", name: "Concreto", value: { description: "Concreto" }, confidence: "HIGH", evidence: { originalRecordId: "row-1", fileName: "scan.pdf" } }],
    })).rejects.toThrow("database connection unavailable");
  });
});
