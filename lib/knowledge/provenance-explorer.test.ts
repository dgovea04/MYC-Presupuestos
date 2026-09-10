import { describe, expect, it, vi } from "vitest";

const { evidence } = vi.hoisted(() => ({ evidence: { findUnique: vi.fn().mockResolvedValue({ id: "ke1", companyId: "c1", projectId: "p1", documentId: "doc1", fileName: "budget.xlsx", page: "2", sheet: "Items", cellRange: "A1:B2", source: { id: "s1", label: "Review", sourceType: "MC_REVISOR", companyId: "c1", projectId: "p1", createdById: "u1" }, canonicalItemLinks: [{ canonicalItemId: "item-1", canonicalItem: { id: "item-1", name: "Cemento" } }], canonicalResourceLinks: [{ canonicalResourceId: "resource-1", canonicalResource: { id: "resource-1", name: "Cemento" } }], priceObservations: [{ id: "price-1", resourceId: "resource-1" }], apuVersions: [{ id: "apu-1", apuId: "apu-source-1" }], reviewEvidenceLinks: [{ reviewEvidenceId: "re1", relationType: "DERIVED_FROM", companyId: "c1", projectId: "p1", reviewEvidence: { id: "re1", companyId: "c1", projectId: "p1", documentVersionId: "dv1", evidenceType: "QUANTITY", originalText: "12.50 m3", locationJson: { sheet: "Items", range: "A1:B2" }, documentVersion: { id: "dv1", versionNumber: 3, projectDocumentId: "doc1", projectDocument: { id: "doc1", name: "Budget", originalFileName: "budget.xlsx" } }, findings: [{ id: "f1", findingType: "QUANTITY_MISMATCH" }] } }] }) } }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { knowledgeEvidence: evidence } }));
import { getKnowledgeEvidenceProvenance } from "./provenance-explorer";

describe("knowledge provenance explorer", () => {
  it("returns source and review evidence links for admin inspection", async () => {
    await expect(getKnowledgeEvidenceProvenance("ke1")).resolves.toEqual(expect.objectContaining({ id: "ke1", source: expect.objectContaining({ id: "s1", label: "Review", sourceType: "MC_REVISOR" }), provenance: expect.objectContaining({ documentId: "doc1", documentVersionId: "dv1", documentVersion: 3, findingIds: ["f1"], locations: [{ sheet: "Items", range: "A1:B2" }], canonicalItemIds: ["item-1"], canonicalResourceIds: ["resource-1"], priceObservationIds: ["price-1"], apuVersionIds: ["apu-1"] }) }));
  });
});
