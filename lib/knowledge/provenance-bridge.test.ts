import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, assertWorkspaceMembership, assertProjectInWorkspace, createKnowledgeSource, createKnowledgeEvidence } = vi.hoisted(() => ({
  prismaMock: {
    reviewEvidence: { findUnique: vi.fn(), findFirst: vi.fn() },
    knowledgeSource: { findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn() },
    knowledgeEvidence: { findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn() },
    knowledgeCanonicalItemProvenance: { upsert: vi.fn() },
    knowledgeCanonicalResourceProvenance: { upsert: vi.fn() },
    knowledgeReviewEvidenceLink: { upsert: vi.fn() },
  },
  assertWorkspaceMembership: vi.fn().mockResolvedValue({ companyId: "c1", role: "EDITOR" }),
  assertProjectInWorkspace: vi.fn().mockResolvedValue(undefined),
  createKnowledgeSource: vi.fn(),
  createKnowledgeEvidence: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership, assertProjectInWorkspace }));
vi.mock("./provenance", () => ({ createKnowledgeSource, createKnowledgeEvidence }));

import { createKnowledgeEvidenceFromReview, createMigrationKnowledgeProvenance, linkMigrationKnowledgeEntity, linkReviewEvidenceToKnowledge, mapReviewEvidenceToKnowledgeEvidence } from "./provenance-bridge";

describe("knowledge provenance bridge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("links evidence only when both records belong to the requested project", async () => {
    prismaMock.reviewEvidence.findUnique.mockResolvedValueOnce({ id: "re1", companyId: "c1", projectId: "p1", documentVersionId: "dv1" });
    prismaMock.knowledgeEvidence.findUnique.mockResolvedValueOnce({ id: "ke1", companyId: "c1", projectId: "p1" });
    prismaMock.knowledgeReviewEvidenceLink.upsert.mockResolvedValueOnce({ id: "link1", relationType: "DERIVED_FROM" });

    await expect(linkReviewEvidenceToKnowledge({ actorUserId: "u1", companyId: "c1", projectId: "p1", reviewEvidenceId: "re1", knowledgeEvidenceId: "ke1", relationType: "DERIVED_FROM" })).resolves.toEqual({ id: "link1", relationType: "DERIVED_FROM" });
    expect(prismaMock.knowledgeReviewEvidenceLink.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { reviewEvidenceId_knowledgeEvidenceId: { reviewEvidenceId: "re1", knowledgeEvidenceId: "ke1" } } }));
  });

  it("rejects a cross-tenant evidence pair without writing a link", async () => {
    prismaMock.reviewEvidence.findUnique.mockResolvedValueOnce({ id: "re1", companyId: "c2", projectId: "p2", documentVersionId: "dv1" });
    prismaMock.knowledgeEvidence.findUnique.mockResolvedValueOnce({ id: "ke1", companyId: "c1", projectId: "p1" });

    await expect(linkReviewEvidenceToKnowledge({ actorUserId: "u1", companyId: "c1", projectId: "p1", reviewEvidenceId: "re1", knowledgeEvidenceId: "ke1", relationType: "DERIVED_FROM" })).rejects.toThrow("tenant");
    expect(prismaMock.knowledgeReviewEvidenceLink.upsert).not.toHaveBeenCalled();
  });

  it("maps review evidence and preserves document version coordinates", () => {
    const result = mapReviewEvidenceToKnowledgeEvidence({
      id: "re1",
      companyId: "c1",
      projectId: "p1",
      documentVersionId: "dv1",
      evidenceType: "QUANTITY",
      originalText: "12.50 m3",
      normalizedText: "12.50 m3",
      locationJson: { sheet: "Metrados", range: "B4:B4", page: 2 },
      value: "12.50",
      unit: "m3",
      extractionMethod: "XLSX_CELL_RANGE",
      confidence: "HIGH",
      sourceHash: "hash-re1",
      metadataJson: { code: "01.01" },
      documentVersion: { projectDocumentId: "doc1", versionNumber: 3, originalFileName: "presupuesto.xlsx", projectDocument: { name: "Presupuesto" } },
    });

    expect(result).toEqual(expect.objectContaining({
      idempotencyKey: "review-evidence:re1",
      documentId: "doc1",
      fileName: "presupuesto.xlsx",
      page: "2",
      sheet: "Metrados",
      cellRange: "B4:B4",
      checksum: "hash-re1",
      quote: "12.50 m3",
    }));
    expect(result.metadata).toEqual(expect.objectContaining({ reviewEvidenceId: "re1", documentVersionId: "dv1", documentVersion: 3, evidenceType: "QUANTITY", code: "01.01" }));
  });

  it("creates and links review evidence idempotently within its tenant", async () => {
    prismaMock.reviewEvidence.findFirst.mockResolvedValueOnce({
      id: "re1", companyId: "c1", projectId: "p1", documentVersionId: "dv1", evidenceType: "QUANTITY", originalText: "12.50 m3", normalizedText: "12.50 m3", locationJson: { sheet: "Metrados", range: "B4:B4" }, value: "12.50", unit: "m3", extractionMethod: "XLSX_CELL_RANGE", confidence: "HIGH", sourceHash: "hash-re1", metadataJson: {},
      documentVersion: { projectDocumentId: "doc1", versionNumber: 3, originalFileName: "presupuesto.xlsx", projectDocument: { name: "Presupuesto" } },
    });
    createKnowledgeSource.mockResolvedValueOnce({ id: "source-1" });
    createKnowledgeEvidence.mockResolvedValueOnce({ id: "knowledge-evidence-1" });
    prismaMock.knowledgeEvidence.findUnique.mockResolvedValueOnce({ id: "knowledge-evidence-1", companyId: "c1", projectId: "p1" });
    prismaMock.reviewEvidence.findUnique.mockResolvedValueOnce({ id: "re1", companyId: "c1", projectId: "p1", documentVersionId: "dv1" });
    prismaMock.knowledgeReviewEvidenceLink.upsert.mockResolvedValueOnce({ id: "link-1", relationType: "DERIVED_FROM" });

    const result = await createKnowledgeEvidenceFromReview({ reviewEvidenceId: "re1", actorUserId: "u1", companyId: "c1", projectId: "p1" });

    expect(createKnowledgeSource).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "review-source:c1:p1", projectId: "p1" }));
    expect(createKnowledgeEvidence).toHaveBeenCalledWith(expect.objectContaining({ sourceId: "source-1", idempotencyKey: "review-evidence:re1", page: undefined, sheet: "Metrados", cellRange: "B4:B4" }));
    expect(result.link).toEqual({ id: "link-1", relationType: "DERIVED_FROM" });
  });

  it("does not write migration provenance during a dry run", async () => {
    const result = await createMigrationKnowledgeProvenance({
      sourceKey: "migration:c1:p1:run-1",
      domain: "resource",
      sourceRecordId: "r1",
      companyId: "c1",
      projectId: "p1",
      correlationId: "run-1",
      dryRun: true,
    });

    expect(result).toEqual({ source: undefined, evidence: undefined, sourceOutcome: "skipped", evidenceOutcome: "skipped" });
    expect(prismaMock.knowledgeSource.create).not.toHaveBeenCalled();
    expect(prismaMock.knowledgeEvidence.create).not.toHaveBeenCalled();
  });

  it("surfaces non-unique persistence errors for the caller to capture per row", async () => {
    prismaMock.knowledgeSource.create.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(createMigrationKnowledgeProvenance({ sourceKey: "migration:c1:p1:run-error", domain: "item", sourceRecordId: "i1", companyId: "c1", projectId: "p1", correlationId: "run-error" })).rejects.toThrow("database unavailable");
    expect(prismaMock.knowledgeEvidence.create).not.toHaveBeenCalled();
  });

  it("reuses migration source and evidence keys on replay", async () => {
    prismaMock.knowledgeSource.create.mockRejectedValueOnce({ code: "P2002" });
    prismaMock.knowledgeSource.findUnique.mockResolvedValueOnce({ id: "source-1" });
    prismaMock.knowledgeEvidence.create.mockRejectedValueOnce({ code: "P2002" });
    prismaMock.knowledgeEvidence.findUnique.mockResolvedValueOnce({ id: "evidence-1" });

    const result = await createMigrationKnowledgeProvenance({
      sourceKey: "migration:c1:p1:run-1",
      domain: "resource",
      sourceRecordId: "r1",
      companyId: "c1",
      projectId: "p1",
      correlationId: "run-1",
    });

    expect(result).toEqual({ source: { id: "source-1" }, evidence: { id: "evidence-1" }, sourceOutcome: "skipped", evidenceOutcome: "skipped" });
    expect(prismaMock.knowledgeSource.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      idempotencyKey: "migration:c1:p1:run-1",
      sourceType: "MIGRATION", createdById: "migration", companyId: "c1", projectId: "p1", metadata: expect.objectContaining({ script: "scripts/backfill-knowledge.ts", correlationId: "run-1" }),
    }) }));
    expect(prismaMock.knowledgeEvidence.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      idempotencyKey: "migration:c1:p1:run-1:evidence:resource:r1",
      sourceId: "source-1", createdById: "migration", companyId: "c1", projectId: "p1", metadata: expect.objectContaining({ domain: "resource", sourceRecordId: "r1", correlationId: "run-1" }),
    }) }));
  });

  it("keeps a separate idempotent provenance link for each canonical association", async () => {
    prismaMock.knowledgeCanonicalItemProvenance.upsert.mockResolvedValueOnce({ id: "item-link-1" });

    await expect(linkMigrationKnowledgeEntity({ domain: "item", entityId: "item-1", sourceId: "source-1", evidenceId: "evidence-1", idempotencyKey: "evidence-key-1" })).resolves.toEqual({ id: "item-link-1" });
    expect(prismaMock.knowledgeCanonicalItemProvenance.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { idempotencyKey: "evidence-key-1" }, create: expect.objectContaining({ canonicalItemId: "item-1", sourceId: "source-1", evidenceId: "evidence-1" }) }));
  });
});
