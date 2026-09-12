import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, assertKnowledgeReadAccess, assertKnowledgeWriteAccess, recordKnowledgeEvent } = vi.hoisted(() => ({
  prismaMock: {
    knowledgeSource: { findMany: vi.fn() },
    knowledgeEvidence: { findMany: vi.fn() },
    knowledgeAssertion: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    priceObservation: { findMany: vi.fn() },
    yieldObservation: { findMany: vi.fn() },
  },
  assertKnowledgeReadAccess: vi.fn().mockResolvedValue(undefined),
  assertKnowledgeWriteAccess: vi.fn().mockResolvedValue(undefined),
  recordKnowledgeEvent: vi.fn().mockResolvedValue({ event: { id: "event-1" }, created: true }),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("./api-access", () => ({ assertKnowledgeReadAccess, assertKnowledgeWriteAccess }));
vi.mock("./events", () => ({ recordKnowledgeEvent }));

import { correctImportLearningAssertion, listImportLearningReview } from "./admin-learning";

describe("import-learning administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertKnowledgeReadAccess.mockResolvedValue(undefined);
    assertKnowledgeWriteAccess.mockResolvedValue(undefined);
    prismaMock.knowledgeSource.findMany.mockResolvedValue([{ id: "source-1" }]);
    prismaMock.knowledgeAssertion.count.mockResolvedValue(1);
    prismaMock.knowledgeAssertion.findMany.mockResolvedValue([{
      id: "assertion-1", subjectType: "IMPORT_ITEM", subjectId: "item-1", predicate: "import_item", value: { name: "Cemento" },
      scope: "PROJECT", status: "REVIEW_REQUIRED", confidence: "HIGH", companyId: "company-1", projectId: "project-1",
      sourceId: "source-1", evidenceId: "evidence-1", reviewFindingId: null, reviewDecisionId: null,
      createdAt: new Date("2026-09-11T10:00:00Z"), updatedAt: new Date("2026-09-11T10:00:00Z"),
    }]);
    prismaMock.priceObservation.findMany.mockResolvedValue([]);
    prismaMock.yieldObservation.findMany.mockResolvedValue([]);
    prismaMock.knowledgeSource.findMany.mockResolvedValue([{ id: "source-1", sourceType: "PDF_IMPORT", label: "scan.pdf" }]);
    prismaMock.knowledgeEvidence.findMany.mockResolvedValue([{ id: "evidence-1", fileName: "scan.pdf", page: "2", sheet: null, cellRange: null, quote: "Cemento" }]);
  });

  it("lists a tenant-scoped import review with filters and pagination", async () => {
    const result = await listImportLearningReview({
      actorUserId: "admin-1", companyId: "company-1", projectId: "project-1", sourceType: "PDF_IMPORT",
      domain: "ITEM", confidence: "HIGH", status: "REVIEW_REQUIRED", regionId: "region-1", page: 2, pageSize: 10,
    });

    expect(result.pagination).toEqual({ page: 2, pageSize: 10, total: 1, totalPages: 1 });
    expect(result.assertions[0]).toMatchObject({ id: "assertion-1", source: { sourceType: "PDF_IMPORT" }, evidence: { fileName: "scan.pdf" } });
    expect(prismaMock.knowledgeAssertion.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, where: expect.objectContaining({ companyId: "company-1", projectId: "project-1", subjectType: "IMPORT_ITEM", confidence: "HIGH" }) }));
    expect(prismaMock.priceObservation.findMany).not.toHaveBeenCalled();
    expect(prismaMock.yieldObservation.findMany).not.toHaveBeenCalled();
  });

  it("creates a corrected review assertion and preserves the original value", async () => {
    prismaMock.knowledgeAssertion.findUnique.mockResolvedValueOnce({
      id: "assertion-1", subjectType: "IMPORT_ITEM", subjectId: "item-1", predicate: "import_item", value: { name: "Cemnto" },
      scope: "PROJECT", status: "REVIEW_REQUIRED", confidence: "HIGH", companyId: "company-1", projectId: "project-1", sourceId: "source-1", evidenceId: "evidence-1",
    });
    prismaMock.knowledgeAssertion.upsert.mockResolvedValueOnce({ id: "assertion-2", status: "REVIEW_REQUIRED" });

    const result = await correctImportLearningAssertion({
      actorUserId: "admin-1", companyId: "company-1", projectId: "project-1", assertionId: "assertion-1",
      value: { name: "Cemento" }, reason: "Corrección ortográfica", correlationId: "corr-1",
    });

    expect(result).toEqual({ originalAssertionId: "assertion-1", correctedAssertionId: "assertion-2", status: "REVIEW_REQUIRED" });
    expect(prismaMock.knowledgeAssertion.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ subjectId: "item-1:correction:corr-1", status: "REVIEW_REQUIRED", value: { name: "Cemento", correctsAssertionId: "assertion-1" } }),
    }));
    expect(recordKnowledgeEvent).toHaveBeenCalledWith(expect.objectContaining({ previousValue: { name: "Cemnto" }, newValue: { name: "Cemento" }, metadata: expect.objectContaining({ originalAssertionId: "assertion-1", correlationId: "corr-1" }) }));
  });
});
