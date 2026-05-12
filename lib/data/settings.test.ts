import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_DATE_FORMAT, DEFAULT_INITIAL_SUB_BUDGET_NAMES } from "@/types/settings";

const { queryRawMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

import { defaultUserSettings, getUserSettings, updateUserSettings } from "@/lib/data/settings";

describe("user settings data", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
  });

  it("returns fallback defaults when there is no user settings row", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([]);

    const settings = await getUserSettings("user-1");

    expect(settings).toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
    });
    expect(settings).not.toBe(defaultUserSettings);
    expect(queryRawMock).toHaveBeenCalledTimes(3);
    expect(queryRawMock.mock.calls[2]?.[1]).toBe("user-1");
    expect(defaultUserSettings).toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
    });
  });

  it("normalizes Prisma.Decimal-backed rate fields from reads", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          currencyDecimals: 2,
          defaultIgvRate: new Prisma.Decimal("0.19"),
          defaultGeneralExpensesRate: new Prisma.Decimal("0.12"),
          defaultUtilityRate: new Prisma.Decimal("0.09"),
        },
      ]);

    await expect(getUserSettings("user-decimal")).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
    });
  });

  it("returns all settings fields from an existing user settings row", async () => {
    const customSubBudgets = ["Estructuras", "Arquitectura"];

    queryRawMock
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          currencyDecimals: 2,
          dateFormat: "DD_MM_YYYY",
          defaultIgvRate: 0.19,
          defaultGeneralExpensesRate: 0.12,
          defaultUtilityRate: 0.09,
          defaultSubBudgetNames: customSubBudgets,
        },
      ]);

    await expect(getUserSettings("user-2")).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: "DD_MM_YYYY",
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: customSubBudgets,
    });
  });

  it("falls back to default settings when the legacy database has no defaultSubBudgetNames column", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          currencyDecimals: 2,
          defaultIgvRate: 0.19,
          defaultGeneralExpensesRate: 0.12,
          defaultUtilityRate: 0.09,
        },
      ]);

    await expect(getUserSettings("legacy-user")).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
    });
    expect(queryRawMock).toHaveBeenCalledTimes(3);
  });

  it("falls back to default date format when the legacy database has no dateFormat column", async () => {
    const customSubBudgets = ["Sanitarias", "Electricas"];

    queryRawMock
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          currencyDecimals: 2,
          defaultIgvRate: 0.19,
          defaultGeneralExpensesRate: 0.12,
          defaultUtilityRate: 0.09,
          defaultSubBudgetNames: customSubBudgets,
        },
      ]);

    await expect(getUserSettings("legacy-date-format")).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: customSubBudgets,
    });
  });

  it("normalizes malformed or partial raw settings rows without overriding defaults incorrectly", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          defaultIgvRate: 0.2,
        },
      ])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([
        {
          defaultCurrency: "EUR",
          currencyDecimals: 2,
          defaultIgvRate: 1.2,
          defaultGeneralExpensesRate: 0.11,
          defaultUtilityRate: -0.01,
        },
      ])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          currencyDecimals: 1.5,
          defaultIgvRate: "0.17",
          defaultGeneralExpensesRate: "0.15",
          defaultUtilityRate: "0.07",
          dateFormat: "DD_MM_YYYY",
        },
      ])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          currencyDecimals: "2",
          defaultIgvRate: "",
          defaultGeneralExpensesRate: null,
          defaultUtilityRate: "1.01",
          dateFormat: "MM_DD_YYYY",
        },
      ]);

    await expect(getUserSettings("partial-row")).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultIgvRate: 0.2,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
    });

    await expect(getUserSettings("invalid-currency")).resolves.toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.11,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
    });

    await expect(getUserSettings("invalid-decimals")).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultIgvRate: 0.17,
      defaultGeneralExpensesRate: 0.15,
      defaultUtilityRate: 0.07,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
    });

    await expect(getUserSettings("coerced-decimals")).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
    });
  });

  it("falls back to in-memory defaults for missing columns when update writes to a legacy table", async () => {
    const customSubBudgets = ["Obra", "Drenajes"];

    queryRawMock
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          currencyDecimals: 2,
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.12,
          defaultUtilityRate: 0.08,
        },
      ]);

    await expect(
      updateUserSettings("legacy-user", {
        defaultCurrency: "USD",
        currencyDecimals: 2,
        dateFormat: "DD_MM_YYYY",
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.12,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: customSubBudgets,
      }),
    ).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: "DD_MM_YYYY",
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: customSubBudgets,
    });

    expect(queryRawMock).toHaveBeenCalledTimes(3);
  });

  it("persists and returns all settings fields", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }])
      .mockImplementationOnce(
        async (
          _query,
          id,
          userId,
          defaultCurrency,
          currencyDecimals,
          dateFormat,
          defaultIgvRate,
          defaultGeneralExpensesRate,
          defaultUtilityRate,
          defaultSubBudgetNames,
        ) => {
          expect(typeof id).toBe("string");
          expect(userId).toBe("user-2");
          expect(defaultCurrency).toBe("USD");
          expect(currencyDecimals).toBe(2);
          expect(dateFormat).toBe("DD_MM_YYYY");
          expect(defaultIgvRate).toBe(0.18);
          expect(defaultGeneralExpensesRate).toBe(0.12);
          expect(defaultUtilityRate).toBe(0.08);
          expect(defaultSubBudgetNames).toEqual(DEFAULT_INITIAL_SUB_BUDGET_NAMES);

          return [
            {
              defaultCurrency: "USD",
              currencyDecimals: 2,
              dateFormat: "DD_MM_YYYY",
              defaultIgvRate: 0.18,
              defaultGeneralExpensesRate: 0.12,
              defaultUtilityRate: 0.08,
              defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
            },
          ];
        },
      );

    await expect(
      updateUserSettings("user-2", {
        defaultCurrency: "USD",
        currencyDecimals: 2,
        dateFormat: "DD_MM_YYYY",
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.12,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
      }),
    ).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: "DD_MM_YYYY",
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
    });

    expect(queryRawMock).toHaveBeenCalledTimes(3);
  });

  it("normalizes Prisma.Decimal-backed rate fields from write returns", async () => {
    const customSubBudgets = ["Obra", "Arquitectura"];

    queryRawMock
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          currencyDecimals: 2,
          dateFormat: "DD_MM",
          defaultIgvRate: new Prisma.Decimal("0.18"),
          defaultGeneralExpensesRate: new Prisma.Decimal("0.12"),
          defaultUtilityRate: new Prisma.Decimal("0.08"),
          defaultSubBudgetNames: customSubBudgets,
        },
      ]);

    await expect(
      updateUserSettings("user-4", {
        defaultCurrency: "USD",
        currencyDecimals: 2,
        dateFormat: "DD_MM",
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.12,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: customSubBudgets,
      }),
    ).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: "DD_MM",
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: customSubBudgets,
    });
  });

  it("throws when updateUserSettings does not receive a returned row", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([]);

    await expect(
      updateUserSettings("user-3", {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
      }),
    ).rejects.toThrow("Failed to persist user settings");
  });
});
