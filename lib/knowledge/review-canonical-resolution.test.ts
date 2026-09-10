import { describe, expect, it } from "vitest";
import { resolvePersistedReviewCanonicalEntities, resolveUniqueCanonicalEntity } from "./review-canonical-resolution";

describe("review canonical resolution", () => {
  it("returns the only normalized candidate with compatible unit", () => {
    expect(resolveUniqueCanonicalEntity([{ id: "item-1", canonicalUnit: "M3", aliases: [] }], "M3")).toEqual("item-1");
  });

  it("skips ambiguous, missing, or unit-incompatible candidates", () => {
    expect(resolveUniqueCanonicalEntity([], "M3")).toBeUndefined();
    expect(resolveUniqueCanonicalEntity([{ id: "item-1", canonicalUnit: "M2", aliases: [] }], "M3")).toBeUndefined();
    expect(resolveUniqueCanonicalEntity([{ id: "item-1", canonicalUnit: "M3", aliases: [] }, { id: "item-2", canonicalUnit: "M3", aliases: [] }], "M3")).toBeUndefined();
  });

  it("resolves canonical ids only from the persisted finding budget item", async () => {
    const client = {
      reviewFinding: { findFirst: async () => ({ findingType: "YIELD_MISMATCH", budgetItem: { description: "Concreto", unit: "m3" } }) },
      canonicalItem: { findMany: async () => [{ id: "item-1", canonicalUnit: "M3", aliases: [] }] },
      canonicalResource: { findMany: async () => [] },
    } as never;
    await expect(resolvePersistedReviewCanonicalEntities({ findingId: "f1", companyId: "c1", projectId: "p1" }, client)).resolves.toEqual({ canonicalItemId: "item-1", resourceId: undefined });
  });

  it("does not resolve a canonical resource when persisted candidates are ambiguous", async () => {
    const client = {
      reviewFinding: { findFirst: async () => ({ findingType: "PRICE_MISMATCH", budgetItem: { description: "Cemento", unit: "bolsa" } }) },
      canonicalItem: { findMany: async () => [] },
      canonicalResource: { findMany: async () => [{ id: "resource-1", canonicalUnit: "BOL", aliases: [] }, { id: "resource-2", canonicalUnit: "BOL", aliases: [] }] },
    } as never;
    await expect(resolvePersistedReviewCanonicalEntities({ findingId: "f1", companyId: "c1", projectId: "p1" }, client)).resolves.toEqual({ canonicalItemId: undefined, resourceId: undefined });
  });
});
