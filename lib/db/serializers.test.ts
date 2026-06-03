import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { serializePolynomialMonomial, serializeResource } from "@/lib/db/serializers";

describe("db serializers", () => {
  it("serializes cached resources whose dates are already ISO strings", () => {
    const resource = serializeResource({
      id: "res-1",
      companyId: null,
      code: "MAT-001",
      description: "Cemento Portland Tipo I",
      category: "MATERIAL",
      iu: null,
      iuCurrent: "21",
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
    expect(resource.iuCurrent).toBe("21");
  });

  it("preserves empty polynomial adjustment index values as null", () => {
    const monomial = serializePolynomialMonomial({
      id: "monomial-1",
      formulaId: "formula-1",
      code: "MO",
      name: "Mano de obra",
      costGroupKey: "LABOR",
      amount: new Prisma.Decimal("100.00"),
      coefficient: new Prisma.Decimal("1.000"),
      baseIndexCode: "47",
      baseIndexName: "MANO DE OBRA",
      baseIndexValue: new Prisma.Decimal("100.000"),
      adjustmentIndexCode: null,
      adjustmentIndexName: null,
      adjustmentIndexValue: null,
      sortOrder: 0,
    });

    expect(monomial.adjustmentIndexValue).toBeNull();
  });
});
