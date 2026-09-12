import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    canonicalItem: { findMany: vi.fn(), create: vi.fn() },
    canonicalResource: { findMany: vi.fn(), create: vi.fn() },
    knowledgeCanonicalItemProvenance: { upsert: vi.fn() },
    knowledgeCanonicalResourceProvenance: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import { promoteImportAssertionToCatalog } from "./canonical-promotion";

describe("import assertion catalog promotion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a COMPANY canonical item and provenance", async () => {
    prismaMock.canonicalItem.findMany.mockResolvedValueOnce([]);
    prismaMock.canonicalItem.create.mockResolvedValueOnce({ id: "item-1" });
    prismaMock.knowledgeCanonicalItemProvenance.upsert.mockResolvedValueOnce({ id: "link-1" });

    await expect(promoteImportAssertionToCatalog({ assertionId: "a1", subjectType: "IMPORT_ITEM", value: { name: "Cemento gris", unit: "kg" }, scope: "COMPANY", companyId: "c1", sourceId: "s1", evidenceId: "e1" })).resolves.toEqual({ catalogEntityType: "CanonicalItem", catalogEntityId: "item-1" });
    expect(prismaMock.canonicalItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: "Cemento gris", canonicalUnit: "KG", scope: "COMPANY", companyId: "c1" }) });
    expect(prismaMock.knowledgeCanonicalItemProvenance.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ canonicalItemId: "item-1", sourceId: "s1", evidenceId: "e1" }) }));
  });

  it("reuses an unambiguous RESOURCE and rejects ambiguous matches", async () => {
    prismaMock.canonicalResource.findMany.mockResolvedValueOnce([{ id: "resource-1", canonicalUnit: "M3", scope: "GLOBAL", companyId: null }]);
    prismaMock.knowledgeCanonicalResourceProvenance.upsert.mockResolvedValueOnce({ id: "link-1" });
    await expect(promoteImportAssertionToCatalog({ assertionId: "a1", subjectType: "IMPORT_RESOURCE", value: { name: "Arena", category: "Agregado", unit: "m3" }, scope: "GLOBAL", companyId: "c1", sourceId: "s1", evidenceId: "e1" })).resolves.toEqual({ catalogEntityType: "CanonicalResource", catalogEntityId: "resource-1" });

    prismaMock.canonicalResource.findMany.mockResolvedValueOnce([{ id: "r1" }, { id: "r2" }]);
    await expect(promoteImportAssertionToCatalog({ assertionId: "a2", subjectType: "IMPORT_RESOURCE", value: { name: "Arena", category: "Agregado", unit: "m3" }, scope: "COMPANY", companyId: "c1", sourceId: "s1", evidenceId: "e1" })).rejects.toThrow("ambiguous");
  });
});
