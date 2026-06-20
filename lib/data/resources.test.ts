import { describe, expect, it } from "vitest";

import { mergeVisibleResourcesForCatalog } from "@/lib/data/resources";

const baseResource = {
  id: "resource-1",
  companyId: null,
  code: "MO-005",
  description: "CAPATAZ",
  category: "LABOR" as const,
  unit: "HH",
  iu: "47 : MANO DE OBRA (INCLUYE LEYES SOCIALES)",
  iuCurrent: "47" as string | null,
  subcategory: null as string | null,
  unitPrice: 0,
  currency: "PEN",
  source: "Catalogo general precargado",
};

describe("mergeVisibleResourcesForCatalog", () => {
  it("deduplicates company copies of global resources and keeps the global resource as priority", () => {
    const rows = mergeVisibleResourcesForCatalog(
      [baseResource],
      [
        {
          ...baseResource,
          id: "company-resource-1",
          companyId: "company-1",
          iuCurrent: null,
        },
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "resource-1",
      companyId: null,
      code: "MO-005",
      description: "CAPATAZ",
      iuCurrent: "47",
    });
  });
});
