import { describe, expect, it, vi } from "vitest";
import { createKnowledgeRegion } from "./regions";

const { findUnique, create } = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn().mockResolvedValue({ id: "r1", name: "Cusco", normalizedName: "cusco" }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { knowledgeRegion: { findUnique, create } } }));

describe("knowledge region service", () => {
  it("normalizes names and validates the parent hierarchy", async () => {
    findUnique.mockResolvedValueOnce({ level: "DEPARTMENT" });
    await createKnowledgeRegion({ level: "PROVINCE", name: " Cúscó ", parentId: "r0" });
    expect(create).toHaveBeenCalledWith({ data: { level: "PROVINCE", name: "Cúscó", normalizedName: "cusco", parentId: "r0" } });
  });

  it("rejects a missing parent", async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(createKnowledgeRegion({ level: "PROVINCE", name: "Cusco", parentId: "missing" })).rejects.toThrow("Parent region not found");
  });
});
