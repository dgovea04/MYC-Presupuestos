import { describe, expect, it, vi } from "vitest";
import { createKnowledgeEvidence, validateProvenance } from "./provenance";

vi.mock("@/lib/db/prisma", () => ({ prisma: { knowledgeEvidence: { create: vi.fn().mockResolvedValue({ id: "e1" }) } } }));

describe("knowledge provenance", () => {
  it("requires a source for every provenance-bearing record", () => {
    expect(() => validateProvenance({})).toThrow("sourceId");
  });
  it("requires inspectable evidence content", async () => {
    await expect(createKnowledgeEvidence({ sourceId: "s1" })).rejects.toThrow("Evidence");
  });
});

