import { describe, expect, it } from "vitest";

import { userSettingsSchema } from "@/lib/validations/settings";
import { DEFAULT_DATE_FORMAT, DEFAULT_INITIAL_SUB_BUDGET_NAMES } from "@/types/settings";

const validSettings = {
  defaultCurrency: "PEN" as const,
  currencyDecimals: 2,
  dateFormat: DEFAULT_DATE_FORMAT,
  defaultIgvRate: 0.18,
  defaultGeneralExpensesRate: 0.12,
  defaultUtilityRate: 0.08,
  defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
};

describe("userSettingsSchema", () => {
  it("accepts PEN and USD as supported default currencies", () => {
    expect(userSettingsSchema.parse(validSettings)).toEqual(validSettings);

    expect(
      userSettingsSchema.parse({
        ...validSettings,
        defaultCurrency: "USD",
      }),
    ).toEqual({
      ...validSettings,
      defaultCurrency: "USD",
    });
  });

  it("rejects unsupported default currencies like EUR", () => {
    expect(() =>
      userSettingsSchema.parse({
        ...validSettings,
        defaultCurrency: "EUR",
      }),
    ).toThrow();
  });

  it("requires defaultCurrency", () => {
    expect(() =>
      userSettingsSchema.parse({
        currencyDecimals: validSettings.currencyDecimals,
        defaultIgvRate: validSettings.defaultIgvRate,
        defaultGeneralExpensesRate: validSettings.defaultGeneralExpensesRate,
        defaultUtilityRate: validSettings.defaultUtilityRate,
      }),
    ).toThrow();
  });

  it("accepts currencyDecimals when it is an integer between 0 and 4", () => {
    expect(
      userSettingsSchema.parse({
        ...validSettings,
        currencyDecimals: "0",
      }),
    ).toEqual({
      ...validSettings,
      currencyDecimals: 0,
    });

    expect(
      userSettingsSchema.parse({
        ...validSettings,
        currencyDecimals: "4",
      }),
    ).toEqual({
      ...validSettings,
      currencyDecimals: 4,
    });

    expect(() =>
      userSettingsSchema.parse({
        ...validSettings,
        currencyDecimals: -1,
      }),
    ).toThrow();

    expect(() =>
      userSettingsSchema.parse({
        ...validSettings,
        currencyDecimals: 1.5,
      }),
    ).toThrow();

    expect(() =>
      userSettingsSchema.parse({
        ...validSettings,
        currencyDecimals: 5,
      }),
    ).toThrow();
  });

  it("accepts supported date formats and rejects unsupported ones", () => {
    expect(
      userSettingsSchema.parse({
        ...validSettings,
        dateFormat: "DD_MM_YYYY",
      }),
    ).toEqual({
      ...validSettings,
      dateFormat: "DD_MM_YYYY",
    });

    expect(() =>
      userSettingsSchema.parse({
        ...validSettings,
        dateFormat: "MM_DD_YYYY",
      }),
    ).toThrow();
  });

  it("accepts valid decimal default budget rates between 0 and 1", () => {
    expect(
      userSettingsSchema.parse({
        ...validSettings,
        defaultIgvRate: "0.18",
        defaultGeneralExpensesRate: 0,
        defaultUtilityRate: 1,
        defaultSubBudgetNames: ["E1"],
      }),
    ).toEqual({
      ...validSettings,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0,
      defaultUtilityRate: 1,
      defaultSubBudgetNames: ["E1"],
    });
  });

  it("rejects out-of-range decimal default budget rates", () => {
    expect(() =>
      userSettingsSchema.parse({
        ...validSettings,
        defaultIgvRate: -0.01,
      }),
    ).toThrow();

    expect(() =>
      userSettingsSchema.parse({
        ...validSettings,
        defaultGeneralExpensesRate: 1.01,
      }),
    ).toThrow();

    expect(() =>
      userSettingsSchema.parse({
        ...validSettings,
        defaultUtilityRate: 1.5,
      }),
    ).toThrow();
  });

  it("rejects malformed currencyDecimals inputs instead of coercing them", () => {
    const malformedValues = ["", "   ", null, true, false];

    for (const malformedValue of malformedValues) {
      expect(
        userSettingsSchema.safeParse({
          ...validSettings,
          currencyDecimals: malformedValue,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects malformed default budget rate inputs instead of coercing them", () => {
    const malformedValues = ["", "   ", null, true, false];
    const rateFields = [
      "defaultIgvRate",
      "defaultGeneralExpensesRate",
      "defaultUtilityRate",
    ] as const;

    for (const malformedValue of malformedValues) {
      for (const rateField of rateFields) {
        expect(
          userSettingsSchema.safeParse({
            ...validSettings,
            [rateField]: malformedValue,
          }).success,
        ).toBe(false);
      }
    }
  });

  it("accepts custom initial sub budget names and removes duplicates", () => {
    expect(
      userSettingsSchema.parse({
        ...validSettings,
        defaultSubBudgetNames: ["Arquitectura", "Estructuras", "Arquitectura", "", "   ", "Instalaciones"],
      }),
    ).toEqual({
      ...validSettings,
      defaultSubBudgetNames: ["Arquitectura", "Estructuras", "Instalaciones"],
    });
  });

  it("requires at least one valid sub budget name", () => {
    expect(
      userSettingsSchema.safeParse({
        ...validSettings,
        defaultSubBudgetNames: ["", "   "],
      }).success,
    ).toBe(false);

    expect(
      userSettingsSchema.safeParse({
        ...validSettings,
        defaultSubBudgetNames: [],
      }).success,
    ).toBe(false);
  });
});
