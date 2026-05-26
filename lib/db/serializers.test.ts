import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { serializeResource } from "@/lib/db/serializers";

describe("db serializers", () => {
  it("serializes cached resources whose dates are already ISO strings", () => {
    const resource = serializeResource({
      id: "res-1",
      companyId: null,
      code: "MAT-001",
      description: "Cemento Portland Tipo I",
      category: "MATERIAL",
      iu: null,
      subcategory: null,
      unit: "bol",
      unitPrice: new Prisma.Decimal("32.50"),
      currency: "PEN",
      source: null,
      createdAt: "2026-05-22T10:00:00.000Z",
      updatedAt: "2026-05-22T11:00:00.000Z",
    });

    expect(resource.createdAt).toBe("2026-05-22T10:00:00.000Z");
    expect(resource.updatedAt).toBe("2026-05-22T11:00:00.000Z");
    expect(resource.unitPrice).toBe(32.5);
  });
});
