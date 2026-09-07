import { describe, expect, it, vi } from "vitest";
import { createCanonicalItem } from "./canonical-items";

vi.mock("@/lib/db/prisma", () => ({ prisma: { canonicalItem: { create: vi.fn().mockResolvedValue({ id: "i1" }) } } }));

describe("canonical item service", () => {
  it("stores a deterministic normalized name and canonical unit", async () => {
    const result = await createCanonicalItem({ scope: "GLOBAL", name: " Excavación manual ", canonicalUnit: "m2" });
    expect(result).toEqual({ id: "i1" });
  });
});

