import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_DATE_FORMAT,
  DEFAULT_EXCEL_ROW_HEIGHT,
  DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
  DEFAULT_INITIAL_SUB_BUDGET_NAMES,
  DEFAULT_VIEW_MODE,
} from "@/types/settings";

const { queryRawMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

import { defaultUserSettings, getUserSettings, updateUserSettings } from "@/lib/data/settings";

function mockUserSettingsColumnSupport({
  defaultSubBudgetNames = true,
  dateFormat = true,
  defaultViewMode = true,
  excelShowFieldBorders = true,
  excelRowHeight = true,
  aiProviderPreference = false,
}: {
  defaultSubBudgetNames?: boolean;
  dateFormat?: boolean;
  defaultViewMode?: boolean;
  excelShowFieldBorders?: boolean;
  excelRowHeight?: boolean;
  aiProviderPreference?: boolean;
}) {
  queryRawMock
    .mockResolvedValueOnce([{ exists: defaultSubBudgetNames }])
    .mockResolvedValueOnce([{ exists: dateFormat }])
    .mockResolvedValueOnce([{ exists: defaultViewMode }])
    .mockResolvedValueOnce([{ exists: excelShowFieldBorders }])
    .mockResolvedValueOnce([{ exists: excelRowHeight }])
    .mockResolvedValueOnce([{ exists: aiProviderPreference }]);
}

describe("user settings data", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
  });

  it("returns fallback defaults when there is no user settings row", async () => {
    mockUserSettingsColumnSupport({});
    queryRawMock.mockResolvedValueOnce([]);

    const settings = await getUserSettings("user-1");

    expect(settings).toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
      aiProviderPreference: "auto",
    });
    expect(settings).not.toBe(defaultUserSettings);
    expect(queryRawMock).toHaveBeenCalledTimes(7);
    expect(queryRawMock.mock.calls[6]?.[2]).toBe("user-1");
    expect(defaultUserSettings).toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
      aiProviderPreference: "auto",
    });
  });

  it("normalizes Prisma.Decimal-backed rate fields from reads", async () => {
    mockUserSettingsColumnSupport({
      defaultSubBudgetNames: false,
      dateFormat: false,
      defaultViewMode: false,
      excelShowFieldBorders: false,
      excelRowHeight: false,
    });
    queryRawMock.mockResolvedValueOnce([
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
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
      aiProviderPreference: "auto",
    });
  });

  it("returns all settings fields from an existing user settings row", async () => {
    const customSubBudgets = ["Estructuras", "Arquitectura"];

    mockUserSettingsColumnSupport({});
    queryRawMock.mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          currencyDecimals: 2,
          dateFormat: "DD_MM_YYYY",
          defaultViewMode: "excel",
          excelShowFieldBorders: false,
          excelRowHeight: 60,
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
      defaultViewMode: "excel",
      excelShowFieldBorders: false,
      excelRowHeight: 60,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: customSubBudgets,
      aiProviderPreference: "auto",
    });
  });

  it("falls back to default settings when the legacy database has no defaultSubBudgetNames column", async () => {
    mockUserSettingsColumnSupport({
      defaultSubBudgetNames: false,
      dateFormat: false,
      defaultViewMode: false,
      excelShowFieldBorders: false,
      excelRowHeight: false,
    });
    queryRawMock.mockResolvedValueOnce([
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
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
      aiProviderPreference: "auto",
    });
    expect(queryRawMock).toHaveBeenCalledTimes(7);
  });

  it("falls back to default date format when the legacy database has no dateFormat column", async () => {
    const customSubBudgets = ["Sanitarias", "Electricas"];

    mockUserSettingsColumnSupport({
      defaultSubBudgetNames: true,
      dateFormat: false,
      defaultViewMode: false,
      excelShowFieldBorders: false,
      excelRowHeight: false,
    });
    queryRawMock.mockResolvedValueOnce([
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
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: customSubBudgets,
      aiProviderPreference: "auto",
    });
  });

  it("normalizes malformed or partial raw settings rows without overriding defaults incorrectly", async () => {
    mockUserSettingsColumnSupport({
      defaultSubBudgetNames: false,
      dateFormat: false,
      defaultViewMode: false,
      excelShowFieldBorders: false,
      excelRowHeight: false,
    });
    queryRawMock.mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          defaultIgvRate: 0.2,
        },
      ]);
    mockUserSettingsColumnSupport({
      defaultSubBudgetNames: false,
      dateFormat: false,
      defaultViewMode: false,
      excelShowFieldBorders: false,
      excelRowHeight: false,
    });
    queryRawMock.mockResolvedValueOnce([
        {
          defaultCurrency: "EUR",
          currencyDecimals: 2,
          defaultIgvRate: 1.2,
          defaultGeneralExpensesRate: 0.11,
          defaultUtilityRate: -0.01,
        },
      ]);
    mockUserSettingsColumnSupport({
      defaultSubBudgetNames: false,
      dateFormat: false,
      defaultViewMode: false,
      excelShowFieldBorders: false,
      excelRowHeight: false,
    });
    queryRawMock.mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          currencyDecimals: 1.5,
          defaultIgvRate: "0.17",
          defaultGeneralExpensesRate: "0.15",
          defaultUtilityRate: "0.07",
          dateFormat: "DD_MM_YYYY",
        },
      ]);
    mockUserSettingsColumnSupport({
      defaultSubBudgetNames: false,
      dateFormat: false,
      defaultViewMode: false,
      excelShowFieldBorders: false,
      excelRowHeight: false,
    });
    queryRawMock.mockResolvedValueOnce([
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
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.2,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
      aiProviderPreference: "auto",
    });

    await expect(getUserSettings("invalid-currency")).resolves.toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.11,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
      aiProviderPreference: "auto",
    });

    await expect(getUserSettings("invalid-decimals")).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.17,
      defaultGeneralExpensesRate: 0.15,
      defaultUtilityRate: 0.07,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
      aiProviderPreference: "auto",
    });

    await expect(getUserSettings("coerced-decimals")).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
      aiProviderPreference: "auto",
    });
  });

  it("falls back to in-memory defaults for missing columns when update writes to a legacy table", async () => {
    const customSubBudgets = ["Obra", "Drenajes"];

    mockUserSettingsColumnSupport({
      defaultSubBudgetNames: false,
      dateFormat: false,
      defaultViewMode: false,
      excelShowFieldBorders: false,
      excelRowHeight: false,
    });
    queryRawMock.mockResolvedValueOnce([
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
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.12,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: customSubBudgets,
        aiProviderPreference: "auto",
      }),
    ).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: "DD_MM_YYYY",
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: customSubBudgets,
      aiProviderPreference: "auto",
    });

    expect(queryRawMock).toHaveBeenCalledTimes(7);
  });

  it("persists and returns all settings fields", async () => {
    mockUserSettingsColumnSupport({});
    queryRawMock.mockImplementationOnce(
        async (
          _query,
          _aiProviderColumn,
          id,
          userId,
          defaultCurrency,
          currencyDecimals,
          dateFormat,
          defaultViewMode,
          excelShowFieldBorders,
          excelRowHeight,
          defaultIgvRate,
          defaultGeneralExpensesRate,
          defaultUtilityRate,
          defaultSubBudgetNames,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Prisma.empty tagged template arg shift
          _aiProviderValue,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _aiProviderConflict,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _aiProviderReturning,
        ) => {
          expect(typeof id).toBe("string");
          expect(userId).toBe("user-2");
          expect(defaultCurrency).toBe("USD");
          expect(currencyDecimals).toBe(2);
          expect(dateFormat).toBe("DD_MM_YYYY");
          expect(defaultViewMode).toBe("excel");
          expect(excelShowFieldBorders).toBe(false);
          expect(excelRowHeight).toBe(60);
          expect(defaultIgvRate).toBe(0.18);
          expect(defaultGeneralExpensesRate).toBe(0.12);
          expect(defaultUtilityRate).toBe(0.08);
          expect(defaultSubBudgetNames).toEqual(DEFAULT_INITIAL_SUB_BUDGET_NAMES);

          return [
            {
              defaultCurrency: "USD",
              currencyDecimals: 2,
              dateFormat: "DD_MM_YYYY",
              defaultViewMode: "excel",
              excelShowFieldBorders: false,
              excelRowHeight: 60,
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
        defaultViewMode: "excel",
        excelShowFieldBorders: false,
        excelRowHeight: 60,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.12,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
        aiProviderPreference: "auto",
      }),
    ).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: "DD_MM_YYYY",
      defaultViewMode: "excel",
      excelShowFieldBorders: false,
      excelRowHeight: 60,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
      aiProviderPreference: "auto",
    });

    expect(queryRawMock).toHaveBeenCalledTimes(7);
  });

  it("normalizes Prisma.Decimal-backed rate fields from write returns", async () => {
    const customSubBudgets = ["Obra", "Arquitectura"];

    mockUserSettingsColumnSupport({});
    queryRawMock.mockResolvedValueOnce([
        {
          defaultCurrency: "USD",
          currencyDecimals: 2,
          dateFormat: "DD_MM",
          defaultViewMode: "excel",
          excelShowFieldBorders: false,
          excelRowHeight: 45,
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
        defaultViewMode: "excel",
        excelShowFieldBorders: false,
        excelRowHeight: 45,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.12,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: customSubBudgets,
        aiProviderPreference: "auto",
      }),
    ).resolves.toEqual({
        defaultCurrency: "USD",
        currencyDecimals: 2,
        dateFormat: "DD_MM",
        defaultViewMode: "excel",
        excelShowFieldBorders: false,
        excelRowHeight: 45,
        defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: customSubBudgets,
      aiProviderPreference: "auto",
    });
  });

  it("throws when updateUserSettings does not receive a returned row", async () => {
    mockUserSettingsColumnSupport({});
    queryRawMock.mockResolvedValueOnce([]);

    await expect(
      updateUserSettings("user-3", {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
        aiProviderPreference: "auto",
      }),
    ).rejects.toThrow("Failed to persist user settings");
  });
});
