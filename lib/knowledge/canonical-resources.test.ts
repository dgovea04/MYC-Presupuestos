import { describe, expect, it } from "vitest";
import { deduplicateCanonicalResourceLookupCandidates, mergeCanonicalResourceLookupCandidates } from "./canonical-resources";

describe("canonical resource lookup candidates", () => {
  it("deduplicates planned candidates by tenant, scope, normalized name, and unit", () => {
    const candidates = deduplicateCanonicalResourceLookupCandidates([
      { id: "resource-1", normalizedName: "Cemento", canonicalUnit: " KG ", scope: "COMPANY", companyId: "company-a", aliases: [] },
      { id: "resource-2", normalizedName: " cemento ", canonicalUnit: "kg", scope: "COMPANY", companyId: "company-a", aliases: [] },
      { id: "resource-3", normalizedName: "Cemento", canonicalUnit: "bolsa", scope: "COMPANY", companyId: "company-a", aliases: [] },
      { id: "resource-4", normalizedName: "Cemento", canonicalUnit: "kg", scope: "COMPANY", companyId: "company-b", aliases: [] },
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({ id: "resource-1", normalizedName: "cemento", canonicalUnit: "KG", companyId: "company-a" }),
      expect.objectContaining({ id: "resource-3", normalizedName: "cemento", canonicalUnit: "BOL", companyId: "company-a" }),
      expect.objectContaining({ id: "resource-4", normalizedName: "cemento", canonicalUnit: "KG", companyId: "company-b" }),
    ]);
  });

  it("removes planned equivalents without collapsing persisted ambiguity", () => {
    const persisted = [
      { id: "persisted-1", normalizedName: "Cemento", canonicalUnit: "KG", scope: "COMPANY", companyId: "company-a", aliases: [] },
      { id: "persisted-2", normalizedName: "Cemento", canonicalUnit: "KG", scope: "COMPANY", companyId: "company-a", aliases: [] },
    ];
    const planned = [
      { id: "planned-equivalent", normalizedName: " cemento ", canonicalUnit: "kg", scope: "COMPANY", companyId: "company-a", aliases: [] },
      { id: "planned-new", normalizedName: "Arena", canonicalUnit: "kg", scope: "COMPANY", companyId: "company-a", aliases: [] },
    ];

    expect(mergeCanonicalResourceLookupCandidates(persisted, planned).map((candidate) => candidate.id)).toEqual([
      "persisted-1",
      "persisted-2",
      "planned-new",
    ]);
  });
});
