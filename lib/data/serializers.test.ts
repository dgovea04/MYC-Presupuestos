import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { serializeBudgetForClientForm, toSerializableNumber } from "@/lib/data/serializers";

describe("toSerializableNumber", () => {
  describe("nullish inputs", () => {
    it("returns null when given null", () => {
      expect(toSerializableNumber(null)).toBeNull();
    });

    it("returns null when given undefined", () => {
      expect(toSerializableNumber(undefined)).toBeNull();
    });

    it("treats any nullish value consistently", () => {
      expect(toSerializableNumber(null)).toBeNull();
      expect(toSerializableNumber(undefined)).toBeNull();
    });
  });

  describe("plain number inputs", () => {
    it("returns the same value for integer zero", () => {
      expect(toSerializableNumber(0)).toBe(0);
    });

    it("returns the same value for positive decimals", () => {
      expect(toSerializableNumber(0.18)).toBe(0.18);
      expect(toSerializableNumber(0.5)).toBe(0.5);
    });

    it("returns the same value for negative numbers", () => {
      expect(toSerializableNumber(-1.5)).toBe(-1.5);
    });

    it("preserves integer values", () => {
      expect(toSerializableNumber(1234)).toBe(1234);
    });
  });

  describe("Prisma.Decimal inputs", () => {
    it("converts Decimal zero to 0", () => {
      expect(toSerializableNumber(new Prisma.Decimal(0))).toBe(0);
    });

    it("converts Decimal with strings to numeric value", () => {
      expect(toSerializableNumber(new Prisma.Decimal("0.18"))).toBe(0.18);
    });

    it("converts Decimal with integer value to number", () => {
      expect(toSerializableNumber(new Prisma.Decimal("1392.40"))).toBe(1392.4);
    });

    it("converts Decimal produced by arithmetic to a JS number", () => {
      const sum = new Prisma.Decimal("100").plus(new Prisma.Decimal("50.25"));
      expect(toSerializableNumber(sum)).toBe(150.25);
    });

    it("preserves negative Decimal values", () => {
      expect(toSerializableNumber(new Prisma.Decimal("-12.34"))).toBe(-12.34);
    });

    it("preserves high-precision Decimal values", () => {
      expect(toSerializableNumber(new Prisma.Decimal("123456789.123456"))).toBe(123456789.123456);
    });
  });

  describe("type discrimination", () => {
    it("returns a primitive JS number (not a Decimal instance) when given a Decimal", () => {
      const result = toSerializableNumber(new Prisma.Decimal("0.18"));
      expect(typeof result).toBe("number");
      expect(result).not.toBeInstanceOf(Prisma.Decimal);
    });

    it("returns null (not undefined) when input is undefined", () => {
      const result = toSerializableNumber(undefined);
      expect(result).toBeNull();
    });
  });
});

describe("serializeBudgetForClientForm", () => {
  function buildDecimalBudget({
    id = "budget-test-1",
    projectId = "project-1",
    parentBudgetId = "budget-general-1",
    kind = "SUB_BUDGET",
    name = "Estructuras",
    currency = "PEN",
    igvRate = new Prisma.Decimal("0.18"),
    generalExpensesRate = new Prisma.Decimal("0.10"),
    utilityRate = new Prisma.Decimal("0.08"),
    totalDirectCost = new Prisma.Decimal("1000"),
    totalGeneralExpenses = new Prisma.Decimal("100"),
    totalUtility = new Prisma.Decimal("80"),
    totalTax = new Prisma.Decimal("212.4"),
    totalAmount = new Prisma.Decimal("1392.4"),
    createdAt = new Date("2026-04-01T00:00:00.000Z"),
    updatedAt = new Date("2026-04-02T00:00:00.000Z"),
  }: Partial<Parameters<typeof import("@/lib/data/serializers").serializeBudgetForClientForm>[0]> = {}) {
    return {
      id,
      projectId,
      parentBudgetId,
      kind,
      name,
      currency,
      igvRate,
      generalExpensesRate,
      utilityRate,
      totalDirectCost,
      totalGeneralExpenses,
      totalUtility,
      totalTax,
      totalAmount,
      createdAt,
      updatedAt,
    };
  }

  describe("scalar passthrough fields", () => {
    it("preserves id, projectId, parentBudgetId, kind, name, and currency verbatim", () => {
      const budget = buildDecimalBudget({
        id: "budget-x",
        projectId: "project-x",
        parentBudgetId: null,
        kind: "GENERAL",
        name: "Presupuesto General",
        currency: "USD",
      });

      const result = serializeBudgetForClientForm(budget);

      expect(result.id).toBe("budget-x");
      expect(result.projectId).toBe("project-x");
      expect(result.parentBudgetId).toBeNull();
      expect(result.kind).toBe("GENERAL");
      expect(result.name).toBe("Presupuesto General");
      expect(result.currency).toBe("USD");
    });
  });

  describe("Decimal field conversion", () => {
    it("converts every Decimal rate field to a plain number", () => {
      const result = serializeBudgetForClientForm(buildDecimalBudget());
      expect(result.igvRate).toBe(0.18);
      expect(result.generalExpensesRate).toBe(0.1);
      expect(result.utilityRate).toBe(0.08);
    });

    it("converts every Decimal total field to a plain number", () => {
      const result = serializeBudgetForClientForm(buildDecimalBudget());
      expect(result.totalDirectCost).toBe(1000);
      expect(result.totalGeneralExpenses).toBe(100);
      expect(result.totalUtility).toBe(80);
      expect(result.totalTax).toBe(212.4);
      expect(result.totalAmount).toBe(1392.4);
    });

    it("accepts plain number inputs for rate fields", () => {
      const result = serializeBudgetForClientForm(
        buildDecimalBudget({
          igvRate: 0.19,
          generalExpensesRate: 0.11,
          utilityRate: 0.09,
          totalDirectCost: 0,
          totalGeneralExpenses: 0,
          totalUtility: 0,
          totalTax: 0,
          totalAmount: 0,
        }),
      );
      expect(result.igvRate).toBe(0.19);
      expect(result.generalExpensesRate).toBe(0.11);
      expect(result.utilityRate).toBe(0.09);
      expect(result.totalDirectCost).toBe(0);
      expect(result.totalGeneralExpenses).toBe(0);
      expect(result.totalUtility).toBe(0);
    });

    it("returns null for any Decimal-like field that is null or undefined", () => {
      const result = serializeBudgetForClientForm({
        ...buildDecimalBudget(),
        igvRate: null as unknown as Prisma.Decimal,
        totalDirectCost: undefined as unknown as Prisma.Decimal,
        totalAmount: undefined as unknown as Prisma.Decimal,
      });
      expect(result.igvRate).toBeNull();
      expect(result.totalDirectCost).toBeNull();
      expect(result.totalAmount).toBeNull();
      // Other fields stay populated
      expect(result.generalExpensesRate).toBe(0.1);
      expect(result.totalTax).toBe(212.4);
    });

    it("produces primitive numbers (not Decimal instances) for every numeric field", () => {
      const result = serializeBudgetForClientForm(buildDecimalBudget());
      for (const field of [
        "igvRate",
        "generalExpensesRate",
        "utilityRate",
        "totalDirectCost",
        "totalGeneralExpenses",
        "totalUtility",
        "totalTax",
        "totalAmount",
      ] as const) {
        const value = result[field];
        expect(typeof value).toBe("number");
        expect(value).not.toBeInstanceOf(Prisma.Decimal);
      }
    });
  });

  describe("Date field conversion", () => {
    it("converts createdAt and updatedAt to ISO 8601 strings", () => {
      const result = serializeBudgetForClientForm(
        buildDecimalBudget({
          createdAt: new Date("2026-01-15T08:30:00.000Z"),
          updatedAt: new Date("2026-02-20T18:45:00.000Z"),
        }),
      );
      expect(result.createdAt).toBe("2026-01-15T08:30:00.000Z");
      expect(result.updatedAt).toBe("2026-02-20T18:45:00.000Z");
    });

    it("returns null when createdAt or updatedAt is null", () => {
      const result = serializeBudgetForClientForm(
        buildDecimalBudget({
          createdAt: null as unknown as Date,
          updatedAt: null as unknown as Date,
        }),
      );
      expect(result.createdAt).toBeNull();
      expect(result.updatedAt).toBeNull();
    });

    it("returns null when createdAt or updatedAt are undefined on the input budget", () => {
      // Constructed manually: passing {createdAt: undefined} to buildDecimalBudget
      // would re-trigger the destructuring defaults and reintroduce Date values.
      const budget: Parameters<typeof serializeBudgetForClientForm>[0] = {
        id: "budget-test-1",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: "Estructuras",
        currency: "PEN",
        igvRate: new Prisma.Decimal("0.18"),
        generalExpensesRate: new Prisma.Decimal("0.10"),
        utilityRate: new Prisma.Decimal("0.08"),
        totalDirectCost: new Prisma.Decimal("1000"),
        totalGeneralExpenses: new Prisma.Decimal("100"),
        totalUtility: new Prisma.Decimal("80"),
        totalTax: new Prisma.Decimal("212.4"),
        totalAmount: new Prisma.Decimal("1392.4"),
        createdAt: undefined,
        updatedAt: undefined,
      };

      const result = serializeBudgetForClientForm(budget);

      expect(result.createdAt).toBeNull();
      expect(result.updatedAt).toBeNull();
    });

    it("never returns a Date instance for createdAt or updatedAt", () => {
      const result = serializeBudgetForClientForm(buildDecimalBudget());
      expect(result.createdAt).not.toBeInstanceOf(Date);
      expect(result.updatedAt).not.toBeInstanceOf(Date);
      expect(typeof result.createdAt).toBe("string");
      expect(typeof result.updatedAt).toBe("string");
    });
  });

  describe("output shape", () => {
    it("returns exactly the documented field set with no extras", () => {
      const result = serializeBudgetForClientForm(buildDecimalBudget());
      expect(Object.keys(result).sort()).toEqual(
        [
          "createdAt",
          "currency",
          "generalExpensesRate",
          "id",
          "igvRate",
          "kind",
          "name",
          "parentBudgetId",
          "projectId",
          "totalAmount",
          "totalDirectCost",
          "totalGeneralExpenses",
          "totalTax",
          "totalUtility",
          "updatedAt",
          "utilityRate",
        ].sort(),
      );
    });
  });
});
