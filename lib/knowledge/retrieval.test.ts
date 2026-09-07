import { describe, expect, it, vi } from "vitest";
import { retrieveCanonicalItems } from "./retrieval";

vi.mock("@/lib/db/prisma", () => ({ prisma: { canonicalItem: { findMany: vi.fn().mockResolvedValue([]) } } }));
import { prisma } from "@/lib/db/prisma";

describe("knowledge retrieval", () => {
  it("queries only visible project, company and global scopes", async () => {
    await retrieveCanonicalItems({ companyId: "c1", projectId: "p1", query: "cemento", limit: 10 });
    const findMany = vi.mocked(prisma.canonicalItem.findMany);
    expect(findMany).toHaveBeenCalledTimes(3);
    expect(findMany.mock.calls.map(([arg]) => arg.where)).toEqual([
      { scope: "PROJECT", companyId: "c1", normalizedName: { contains: "cemento" } },
      { scope: "COMPANY", companyId: "c1", normalizedName: { contains: "cemento" } },
      { scope: "GLOBAL", companyId: undefined, normalizedName: { contains: "cemento" } },
    ]);
  });
});
