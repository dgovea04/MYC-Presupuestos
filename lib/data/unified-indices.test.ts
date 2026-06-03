import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    resource: {
      findMany: vi.fn(),
    },
    unifiedIndex: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  getUnifiedIndexDictionaryRows,
  getUnifiedIndexRelationRows,
} from "@/lib/data/unified-indices";

describe("getUnifiedIndexRelationRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dedupes official IU relations by code and name and counts accessible resources", async () => {
    mocks.prisma.unifiedIndex.findMany.mockResolvedValue([
      { code: "03", name: "Acero corrugado" },
      { code: "03", name: "Acero corrugado" },
      { code: "47", name: "Mano de obra (incluye leyes sociales)" },
      { code: "47", name: "Mano de obra (incluye leyes sociales)" },
      { code: "92", name: "Flete fluvial" },
    ]);
    mocks.prisma.resource.findMany.mockResolvedValue([
      { iu: "47", iuCurrent: null },
      { iu: "47", iuCurrent: null },
      { iu: "03", iuCurrent: null },
      { iu: "03 ", iuCurrent: null },
      { iu: "3 : Acero de construccion corrugado", iuCurrent: null },
      { iu: "47 : Mano de obra (incluye leyes sociales)", iuCurrent: null },
      { iu: "01 : Aceite y lubricante", iuCurrent: "47" },
      { iu: " ", iuCurrent: null },
      { iu: ":", iuCurrent: null },
      { iu: null, iuCurrent: null },
    ]);

    await expect(getUnifiedIndexRelationRows("user-1")).resolves.toEqual([
      {
        code: "03",
        name: "Acero corrugado",
        resourceCount: 3,
      },
      {
        code: "47",
        name: "Mano de obra (incluye leyes sociales)",
        resourceCount: 4,
      },
      {
        code: "92",
        name: "Flete fluvial",
        resourceCount: 0,
      },
    ]);
    expect(mocks.prisma.resource.findMany).toHaveBeenCalledWith({
      select: {
        iu: true,
        iuCurrent: true,
      },
      where: {
        OR: [
          { companyId: null },
          {
            company: {
              userId: "user-1",
            },
          },
        ],
      },
    });
  });
});

describe("getUnifiedIndexDictionaryRows", () => {
  it("returns alphabetical dictionary rows from the serialized official source", async () => {
    const rows = await getUnifiedIndexDictionaryRows();

    expect(rows[0]).toEqual({
      code: "2",
      element: "Abrazadera de acero",
      note: null,
    });
    expect(rows.find((row) => row.code === "66" && row.element === "Accesorio PVC-U para redes de agua")).toBeDefined();
    expect(rows.find((row) => row.code === "3" && row.element === "Acero corrugado ASTM A496")).toBeDefined();
    expect(rows).toEqual(
      [...rows].sort((left, right) => left.element.localeCompare(right.element, "es")),
    );
  });
});
