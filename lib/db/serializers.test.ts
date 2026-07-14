import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { serializePolynomialMonomial, serializeResource, stripBudgetProjectForClient } from "@/lib/db/serializers";

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

describe("stripBudgetProjectForClient", () => {
  it("drops the raw `project` field (Prisma Decimals) from a budget record", () => {
    // Simulate the raw `project` payload from `_getBudgetById` with a
    // Prisma.Decimal-like class instance on every Decimal column. A
    // class instance is required because a plain object literal would
    // pass the RSC serialization check (plain object detection is by
    // prototype), defeating the regression test.
    class FakeDecimal {
      toString() { return "100"; }
      toFixed() { return "100.00"; }
    }
    const fakeBuiltArea = new FakeDecimal();

    const budget = {
      id: "budget-1",
      projectId: "project-1",
      kind: "SUB_BUDGET",
      name: "Sub Presupuesto Demo",
      currency: "PEN",
      igvRate: 0.18,
      totalDirectCost: 0,
      totalAmount: 0,
      levels: [],
      items: [],
      project: {
        id: "project-1",
        companyId: "company-1",
        name: "Proyecto Demo",
        builtArea: fakeBuiltArea,
        landArea: fakeBuiltArea,
        buildingHeight: fakeBuiltArea,
        contractAmount: fakeBuiltArea,
        referenceBudget: fakeBuiltArea,
      },
    };

    const result = stripBudgetProjectForClient(budget);

    expect("project" in result).toBe(false);
    // Serialized fields are preserved untouched.
    expect(result.id).toBe("budget-1");
    expect(result.name).toBe("Sub Presupuesto Demo");
    expect(result.totalAmount).toBe(0);
    expect(result.levels).toEqual([]);
    expect(result.items).toEqual([]);
  });

  it("is a no-op when the budget's `project` field is explicitly undefined", () => {
    // In practice `getBudgetById()` always returns a `project` field (that's
    // the whole point of the bug this helper exists to work around), so the
    // "no project" path is exercised by passing `project: undefined` rather
    // than omitting the key entirely (which fails TypeScript's strict
    // optional-property check).
    const budget = {
      id: "budget-1",
      name: "Sin project",
      totalAmount: 100,
      project: undefined,
    };

    const result = stripBudgetProjectForClient(budget);

    expect(result.id).toBe("budget-1");
    expect(result.name).toBe("Sin project");
    expect(result.totalAmount).toBe(100);
    expect("project" in result).toBe(false);
  });

  it("does not mutate the input budget", () => {
    const budget = {
      id: "budget-1",
      name: "Test",
      project: { id: "project-1" },
    };

    const snapshot = JSON.parse(JSON.stringify(budget));
    stripBudgetProjectForClient(budget);

    // The original input is untouched (the helper uses destructuring, not
    // in-place mutation).
    expect(budget).toEqual(snapshot);
  });
});
