import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({ prismaMock: {
  canonicalItem: { findMany: vi.fn().mockResolvedValue([{ id: "item-project", scope: "PROJECT", companyId: "c1", normalizedName: "cemento" }]) },
  canonicalResource: { findMany: vi.fn().mockResolvedValue([{ id: "resource-company", scope: "COMPANY", companyId: "c1", normalizedName: "cemento" }]) },
  priceObservation: { findMany: vi.fn().mockResolvedValue([]) },
  yieldObservation: { findMany: vi.fn().mockResolvedValue([]) },
  knowledgeApuVersion: { findMany: vi.fn().mockResolvedValue([]) },
  knowledgeAssertion: { findMany: vi.fn().mockResolvedValue([]) },
} }));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import { retrieveKnowledgeV1 } from "./retrieval-v1";

describe("knowledge retrieval v1", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retrieves composite knowledge in project, company, global precedence", async () => {
    const result = await retrieveKnowledgeV1({ companyId: "c1", projectId: "p1", query: "cemento", limit: 10 });
    expect(result.items[0]?.id).toBe("item-project");
    expect(result.resources[0]?.id).toBe("resource-company");
    expect(prismaMock.canonicalItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ scope: "PROJECT", companyId: "c1" }) }));
    expect(prismaMock.canonicalItem.findMany).toHaveBeenCalledTimes(3);
    expect(prismaMock.priceObservation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ scope: "PROJECT", projectId: "p1" }) }));
    expect(prismaMock.knowledgeApuVersion.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ scope: "PROJECT", projectId: "p1" }) }));
  });

  it("caps each result collection and never queries outside visible scopes", async () => {
    await retrieveKnowledgeV1({ companyId: "c1", query: "cemento", limit: 2 });
    expect(prismaMock.canonicalItem.findMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.canonicalItem.findMany.mock.calls.every(([arg]) => ["COMPANY", "GLOBAL"].includes(arg.where.scope))).toBe(true);
  });

  it("uses exact alias matching and applies status, confidence, and region filters", async () => {
    await retrieveKnowledgeV1({ companyId: "c1", projectId: "p1", query: "cemento gris", status: "OBSERVED", confidence: "HIGH", regionId: "r1", limit: 5 });
    expect(prismaMock.canonicalItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "OBSERVED", OR: expect.arrayContaining([{ aliases: { some: { normalizedAlias: "cemento gris" } } }]) }) }));
    expect(prismaMock.priceObservation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ confidence: "HIGH", regionId: "r1" }) }));
  });

  it("returns complete provenance summaries and empty collections when no entity matches", async () => {
    prismaMock.canonicalItem.findMany.mockResolvedValue([]);
    prismaMock.canonicalResource.findMany.mockResolvedValue([]);
    prismaMock.priceObservation.findMany.mockResolvedValue([{ id: "price-1", scope: "COMPANY", companyId: "c1", projectId: null, resourceId: "resource-1", sourceId: "source-1", evidenceId: "evidence-1", observedAt: new Date("2026-09-09T12:00:00Z"), regionId: "r1", supplierId: "sup-1", source: { id: "source-1", label: "Lista" }, evidence: { id: "evidence-1", page: "2", sheet: null, cellRange: "B4" } }]);
    const result = await retrieveKnowledgeV1({ companyId: "c1", query: "inexistente", limit: 5 });
    expect(result.items).toEqual([]);
    expect(result.resources).toEqual([]);
    expect(result.prices[0]?.provenance).toMatchObject({ sourceId: "source-1", evidenceId: "evidence-1", regionId: "r1", supplierId: "sup-1", source: { label: "Lista" }, evidence: { page: "2", cellRange: "B4" } });
  });

  it("retrieves all canonical provenance associations", async () => {
    prismaMock.canonicalItem.findMany.mockResolvedValue([{ id: "item-1", scope: "COMPANY", companyId: "c1", normalizedName: "cemento", aliases: [], provenanceLinks: [{ sourceId: "s1", evidenceId: "e1", source: { id: "s1" }, evidence: { id: "e1" } }, { sourceId: "s2", evidenceId: "e2", source: { id: "s2" }, evidence: { id: "e2" } }] }]);
    prismaMock.canonicalResource.findMany.mockResolvedValue([{ id: "resource-1", scope: "COMPANY", companyId: "c1", normalizedName: "cemento", aliases: [], provenanceLinks: [{ sourceId: "s3", evidenceId: "e3", source: { id: "s3" }, evidence: { id: "e3" } }] }]);

    const result = await retrieveKnowledgeV1({ companyId: "c1", query: "cemento", limit: 5 });

    expect(result.items[0]?.provenance).toMatchObject({ sourceIds: ["s1", "s2"], evidenceIds: ["e1", "e2"] });
    expect(result.resources[0]?.provenance).toMatchObject({ sourceIds: ["s3"], evidenceIds: ["e3"] });
    expect(prismaMock.canonicalItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({ provenanceLinks: expect.objectContaining({ include: expect.any(Object) }) }) }));
  });
});
