import { describe, expect, it, vi } from "vitest";
import { apuContentHash, createApuVersionFromExistingApu } from "./apu";

vi.mock("@/lib/db/prisma", () => ({ prisma: { knowledgeApuVersion: { findFirst: vi.fn().mockResolvedValue({ versionNumber: 2 }), create: vi.fn().mockResolvedValue({ id: "v3", versionNumber: 3 }) } } }));

const input = { scope: "PROJECT" as const, companyId: "c1", projectId: "p1", apuId: "a1", name: "Concreto", unit: "M3", performance: "8.12345", resources: [{ description: "Cemento", unit: "BOL", quantity: "4.2", unitPrice: "31.5", resourceType: "MATERIAL", sortOrder: 0 }] };

describe("knowledge APU versions", () => {
  it("creates the next version with a stable Decimal-safe content hash", async () => {
    expect(apuContentHash(input)).toBe(apuContentHash({ ...input, performance: "8.12349" }));
    await expect(createApuVersionFromExistingApu(input)).resolves.toMatchObject({ versionNumber: 3 });
  });
});
