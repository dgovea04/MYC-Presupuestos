import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_APP_THEME,
  DEFAULT_DATE_FORMAT,
  DEFAULT_EXCEL_ROW_HEIGHT,
  DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
  DEFAULT_INITIAL_SUB_BUDGET_NAMES,
  DEFAULT_VIEW_MODE,
  FLOATING_KHIPU_DEFAULTS,
} from "@/types/settings";

const { queryRawMock, upsertMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
    userSettings: {
      upsert: upsertMock,
      findUnique: vi.fn(),
    },
  },
}));

import { AiProviderSettings, defaultUserSettings, getUserSettings, updateUserSettings, updateAiProviderSettings } from "@/lib/data/settings";

type ColumnSupportFlags = {
  defaultSubBudgetNames?: boolean;
  dateFormat?: boolean;
  appTheme?: boolean;
  defaultViewMode?: boolean;
  excelShowFieldBorders?: boolean;
  excelRowHeight?: boolean;
  aiProviderPreference?: boolean;
  floatingKhipuProvider?: boolean;
  floatingKhipuWidth?: boolean;
  floatingKhipuHeight?: boolean;
  floatingKhipuFontSize?: boolean;
  floatingKhipuPosition?: boolean;
  floatingKhipuTheme?: boolean;
};

function buildSupportedColumnRows({
  defaultSubBudgetNames = true,
  dateFormat = true,
  appTheme = true,
  defaultViewMode = true,
  excelShowFieldBorders = true,
  excelRowHeight = true,
  aiProviderPreference = false,
  floatingKhipuProvider = false,
  floatingKhipuWidth = false,
  floatingKhipuHeight = false,
  floatingKhipuFontSize = false,
  floatingKhipuPosition = false,
  floatingKhipuTheme = false,
}: ColumnSupportFlags) {
  const flags = {
    defaultSubBudgetNames,
    dateFormat,
    appTheme,
    defaultViewMode,
    excelShowFieldBorders,
    excelRowHeight,
    aiProviderPreference,
    floatingKhipuProvider,
    floatingKhipuWidth,
    floatingKhipuHeight,
    floatingKhipuFontSize,
    floatingKhipuPosition,
    floatingKhipuTheme,
  };

  return Object.entries(flags)
    .filter(([, enabled]) => enabled)
    .map(([columnName]) => ({ columnName }));
}

function mockUserSettingsColumnSupport(flags: ColumnSupportFlags) {
  queryRawMock.mockResolvedValueOnce(buildSupportedColumnRows(flags));
}

function mockUserSettingsColumnChecks({
  defaultSubBudgetNames = true,
  dateFormat = true,
  appTheme = true,
  defaultViewMode = true,
  excelShowFieldBorders = true,
  excelRowHeight = true,
  aiProviderPreference = false,
  floatingKhipuProvider = false,
  floatingKhipuWidth = false,
  floatingKhipuHeight = false,
  floatingKhipuFontSize = false,
  floatingKhipuPosition = false,
  floatingKhipuTheme = false,
}: ColumnSupportFlags) {
  queryRawMock
    .mockResolvedValueOnce([{ exists: defaultSubBudgetNames }])
    .mockResolvedValueOnce([{ exists: dateFormat }])
    .mockResolvedValueOnce([{ exists: appTheme }])
    .mockResolvedValueOnce([{ exists: defaultViewMode }])
    .mockResolvedValueOnce([{ exists: excelShowFieldBorders }])
    .mockResolvedValueOnce([{ exists: excelRowHeight }])
    .mockResolvedValueOnce([{ exists: aiProviderPreference }])
    .mockResolvedValueOnce([{ exists: floatingKhipuProvider }])
    .mockResolvedValueOnce([{ exists: floatingKhipuWidth }])
    .mockResolvedValueOnce([{ exists: floatingKhipuHeight }])
    .mockResolvedValueOnce([{ exists: floatingKhipuFontSize }])
    .mockResolvedValueOnce([{ exists: floatingKhipuPosition }])
    .mockResolvedValueOnce([{ exists: floatingKhipuTheme }]);
}

const DEFAULT_FLOATING_KHIPU_FIELDS = {
  floatingKhipuProvider: FLOATING_KHIPU_DEFAULTS.provider,
  floatingKhipuWidth: FLOATING_KHIPU_DEFAULTS.width,
  floatingKhipuHeight: FLOATING_KHIPU_DEFAULTS.height,
  floatingKhipuFontSize: FLOATING_KHIPU_DEFAULTS.fontSize,
  floatingKhipuPosition: FLOATING_KHIPU_DEFAULTS.position,
  floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
};

describe("user settings data", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
    upsertMock.mockReset();
  });

  // ─── getUserSettings tests ──────────────────────────────────

  it("returns fallback defaults when there is no user settings row", async () => {
    mockUserSettingsColumnSupport({});
    queryRawMock.mockResolvedValueOnce([]);

    const settings = await getUserSettings("user-1");

    expect(settings).toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });
    expect(settings).not.toBe(defaultUserSettings);
    expect(queryRawMock).toHaveBeenCalledTimes(2);
    expect(queryRawMock.mock.calls[1]?.[8]).toBe("user-1");
    expect(defaultUserSettings).toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });
  });

  it("normalizes Prisma.Decimal-backed rate fields from reads", async () => {
    mockUserSettingsColumnSupport({
      defaultSubBudgetNames: false,
      dateFormat: false,
      defaultViewMode: false,
      excelShowFieldBorders: false,
      excelRowHeight: false,
      floatingKhipuTheme: false,
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
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });
  });

  it("returns all settings fields from an existing user settings row", async () => {
    const customSubBudgets = ["Estructuras", "Arquitectura"];

    mockUserSettingsColumnSupport({ floatingKhipuTheme: true });
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
          floatingKhipuTheme: "dark",
        },
      ]);

    await expect(getUserSettings("user-2")).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: "DD_MM_YYYY",
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: "excel",
      excelShowFieldBorders: false,
      excelRowHeight: 60,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: customSubBudgets,
      aiProviderPreference: "auto",
      floatingKhipuProvider: FLOATING_KHIPU_DEFAULTS.provider,
      floatingKhipuWidth: FLOATING_KHIPU_DEFAULTS.width,
      floatingKhipuHeight: FLOATING_KHIPU_DEFAULTS.height,
      floatingKhipuFontSize: FLOATING_KHIPU_DEFAULTS.fontSize,
      floatingKhipuPosition: FLOATING_KHIPU_DEFAULTS.position,
      floatingKhipuTheme: "dark",
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
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });
    expect(queryRawMock).toHaveBeenCalledTimes(2);
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
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: customSubBudgets,
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
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
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.2,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });

    await expect(getUserSettings("invalid-currency")).resolves.toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.11,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });

    await expect(getUserSettings("invalid-decimals")).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.17,
      defaultGeneralExpensesRate: 0.15,
      defaultUtilityRate: 0.07,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });

    await expect(getUserSettings("coerced-decimals")).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });
  });

  // ─── getUserSettings: floating Khipu fields ─────────────────

  it("returns floating Khipu defaults when columns are missing", async () => {
    mockUserSettingsColumnSupport({
      floatingKhipuProvider: false,
      floatingKhipuWidth: false,
      floatingKhipuHeight: false,
      floatingKhipuFontSize: false,
      floatingKhipuPosition: false,
    });
    queryRawMock.mockResolvedValueOnce([
      {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      },
    ]);

    await expect(getUserSettings("no-floating-cols")).resolves.toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      floatingKhipuProvider: "ollama",
      floatingKhipuWidth: 600,
      floatingKhipuHeight: 500,
      floatingKhipuFontSize: "normal",
      floatingKhipuPosition: "bottom-right",
      floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
    });
  });

  it("reads custom floating Khipu values from the database when columns exist", async () => {
    mockUserSettingsColumnSupport({
      floatingKhipuProvider: true,
      floatingKhipuWidth: true,
      floatingKhipuHeight: true,
      floatingKhipuFontSize: true,
      floatingKhipuPosition: true,
    });
    queryRawMock.mockResolvedValueOnce([
      {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
        floatingKhipuProvider: "openai",
        floatingKhipuWidth: 500,
        floatingKhipuHeight: 400,
        floatingKhipuFontSize: "compact",
        floatingKhipuPosition: "top-left",
      },
    ]);

    await expect(getUserSettings("floating-custom")).resolves.toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      floatingKhipuProvider: "openai",
      floatingKhipuWidth: 500,
      floatingKhipuHeight: 400,
      floatingKhipuFontSize: "compact",
      floatingKhipuPosition: "top-left",
      floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
    });
  });

  it("falls back to defaults for unrecognized floating Khipu values", async () => {
    mockUserSettingsColumnSupport({
      floatingKhipuProvider: true,
      floatingKhipuWidth: true,
      floatingKhipuHeight: true,
      floatingKhipuFontSize: true,
      floatingKhipuPosition: true,
    });
    queryRawMock.mockResolvedValueOnce([
      {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
        floatingKhipuProvider: "invalid_provider",
        floatingKhipuWidth: "not-a-number",
        floatingKhipuHeight: null,
        floatingKhipuFontSize: "huge",
        floatingKhipuPosition: "center",
      },
    ]);

    await expect(getUserSettings("floating-bad")).resolves.toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      floatingKhipuProvider: "ollama",
      floatingKhipuWidth: 600,
      floatingKhipuHeight: 500,
      floatingKhipuFontSize: "normal",
      floatingKhipuPosition: "bottom-right",
      floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
    });
  });

  // ─── updateUserSettings tests ────────────────────────────────

  it("falls back to in-memory defaults for missing columns when update writes to a legacy table", async () => {
    const customSubBudgets = ["Obra", "Drenajes"];

    mockUserSettingsColumnChecks({
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
        appTheme: DEFAULT_APP_THEME,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.12,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: customSubBudgets,
        aiProviderPreference: "auto",
        floatingKhipuProvider: FLOATING_KHIPU_DEFAULTS.provider,
        floatingKhipuWidth: FLOATING_KHIPU_DEFAULTS.width,
        floatingKhipuHeight: FLOATING_KHIPU_DEFAULTS.height,
        floatingKhipuFontSize: FLOATING_KHIPU_DEFAULTS.fontSize,
        floatingKhipuPosition: FLOATING_KHIPU_DEFAULTS.position,
        floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
      }),
    ).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: "DD_MM_YYYY",
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: customSubBudgets,
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });

    expect(queryRawMock).toHaveBeenCalledTimes(14);
  });

  it("persists and returns all settings fields", async () => {
    mockUserSettingsColumnChecks({});
    queryRawMock.mockImplementationOnce(
        async (
          _query,
          _aiProviderColumn,
          _floatingKhipuProviderColumn,
          _floatingKhipuWidthColumn,
          _floatingKhipuHeightColumn,
          _floatingKhipuFontSizeColumn,
          _floatingKhipuPositionColumn,
          _floatingKhipuThemeColumn,
          id,
          userId,
          defaultCurrency,
          currencyDecimals,
          dateFormat,
          appTheme,
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
          _floatingKhipuProviderValue,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuWidthValue,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuHeightValue,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuFontSizeValue,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuPositionValue,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuThemeValue,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _aiProviderConflict,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuProviderConflict,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuWidthConflict,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuHeightConflict,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuFontSizeConflict,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuPositionConflict,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuThemeConflict,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _aiProviderReturning,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuProviderReturning,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuWidthReturning,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuHeightReturning,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuFontSizeReturning,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuPositionReturning,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _floatingKhipuThemeReturning,
        ) => {
          expect(typeof id).toBe("string");
          expect(userId).toBe("user-2");
          expect(defaultCurrency).toBe("USD");
          expect(currencyDecimals).toBe(2);
          expect(dateFormat).toBe("DD_MM_YYYY");
          expect(appTheme).toBe(DEFAULT_APP_THEME);
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
              appTheme: DEFAULT_APP_THEME,
              defaultViewMode: "excel",
              excelShowFieldBorders: false,
              excelRowHeight: 60,
              defaultIgvRate: 0.18,
              defaultGeneralExpensesRate: 0.12,
              defaultUtilityRate: 0.08,
              defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
            },
          ];
        },
      );

    await expect(
      updateUserSettings("user-2", {
        defaultCurrency: "USD",
        currencyDecimals: 2,
        dateFormat: "DD_MM_YYYY",
        appTheme: DEFAULT_APP_THEME,
        defaultViewMode: "excel",
        excelShowFieldBorders: false,
        excelRowHeight: 60,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.12,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
        aiProviderPreference: "auto",
        floatingKhipuProvider: FLOATING_KHIPU_DEFAULTS.provider,
        floatingKhipuWidth: FLOATING_KHIPU_DEFAULTS.width,
        floatingKhipuHeight: FLOATING_KHIPU_DEFAULTS.height,
        floatingKhipuFontSize: FLOATING_KHIPU_DEFAULTS.fontSize,
        floatingKhipuPosition: FLOATING_KHIPU_DEFAULTS.position,
        floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
      }),
    ).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: "DD_MM_YYYY",
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: "excel",
      excelShowFieldBorders: false,
      excelRowHeight: 60,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });

    expect(queryRawMock).toHaveBeenCalledTimes(14);
  });

  it("normalizes Prisma.Decimal-backed rate fields from write returns", async () => {
    const customSubBudgets = ["Obra", "Arquitectura"];

    mockUserSettingsColumnChecks({});
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
        appTheme: DEFAULT_APP_THEME,
        defaultViewMode: "excel",
        excelShowFieldBorders: false,
        excelRowHeight: 45,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.12,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: customSubBudgets,
        aiProviderPreference: "auto",
        floatingKhipuProvider: FLOATING_KHIPU_DEFAULTS.provider,
        floatingKhipuWidth: FLOATING_KHIPU_DEFAULTS.width,
        floatingKhipuHeight: FLOATING_KHIPU_DEFAULTS.height,
        floatingKhipuFontSize: FLOATING_KHIPU_DEFAULTS.fontSize,
        floatingKhipuPosition: FLOATING_KHIPU_DEFAULTS.position,
        floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
      }),
    ).resolves.toEqual({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      dateFormat: "DD_MM",
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: "excel",
      excelShowFieldBorders: false,
      excelRowHeight: 45,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: customSubBudgets,
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });
  });

  it("throws when updateUserSettings does not receive a returned row", async () => {
    mockUserSettingsColumnChecks({});
    queryRawMock.mockResolvedValueOnce([]);

    await expect(
      updateUserSettings("user-3", {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        appTheme: DEFAULT_APP_THEME,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
        aiProviderPreference: "auto",
        floatingKhipuProvider: FLOATING_KHIPU_DEFAULTS.provider,
        floatingKhipuWidth: FLOATING_KHIPU_DEFAULTS.width,
        floatingKhipuHeight: FLOATING_KHIPU_DEFAULTS.height,
        floatingKhipuFontSize: FLOATING_KHIPU_DEFAULTS.fontSize,
        floatingKhipuPosition: FLOATING_KHIPU_DEFAULTS.position,
        floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
      }),
    ).rejects.toThrow("Failed to persist user settings");
  });

  // ─── updateUserSettings: floating Khipu persistence ──────────

  it("persists and returns custom floating Khipu values", async () => {
    mockUserSettingsColumnChecks({
      floatingKhipuProvider: true,
      floatingKhipuWidth: true,
      floatingKhipuHeight: true,
      floatingKhipuFontSize: true,
      floatingKhipuPosition: true,
    });
    queryRawMock.mockResolvedValueOnce([
      {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
        floatingKhipuProvider: "gemini",
        floatingKhipuWidth: 700,
        floatingKhipuHeight: 550,
        floatingKhipuFontSize: "large",
        floatingKhipuPosition: "top-right",
      },
    ]);

    await expect(
      updateUserSettings("float-write", {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        appTheme: DEFAULT_APP_THEME,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
        aiProviderPreference: "auto",
        floatingKhipuProvider: "gemini",
        floatingKhipuWidth: 700,
        floatingKhipuHeight: 550,
        floatingKhipuFontSize: "large",
        floatingKhipuPosition: "top-right",
        floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
      }),
    ).resolves.toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      floatingKhipuProvider: "gemini",
      floatingKhipuWidth: 700,
      floatingKhipuHeight: 550,
      floatingKhipuFontSize: "large",
      floatingKhipuPosition: "top-right",
      floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
    });
  });

  it("returns defaults for floating Khipu fields when write columns are missing", async () => {
    mockUserSettingsColumnChecks({
      floatingKhipuProvider: false,
      floatingKhipuWidth: false,
      floatingKhipuHeight: false,
      floatingKhipuFontSize: false,
      floatingKhipuPosition: false,
    });
    queryRawMock.mockResolvedValueOnce([
      {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      },
    ]);

    await expect(
      updateUserSettings("float-write-legacy", {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        appTheme: DEFAULT_APP_THEME,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
        aiProviderPreference: "auto",
        floatingKhipuProvider: "gemini",
        floatingKhipuWidth: 700,
        floatingKhipuHeight: 550,
        floatingKhipuFontSize: "large",
        floatingKhipuPosition: "top-right",
        floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
      }),
    ).resolves.toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });
  });

  // ─── floating Khipu theme tests ───────────────────────────────

  it("returns default light theme when column is missing", async () => {
    mockUserSettingsColumnSupport({ floatingKhipuTheme: false });
    queryRawMock.mockResolvedValueOnce([
      {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      },
    ]);

    await expect(getUserSettings("no-theme-col")).resolves.toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      ...DEFAULT_FLOATING_KHIPU_FIELDS,
    });
  });

  it("reads custom dark theme from database", async () => {
    mockUserSettingsColumnSupport({ floatingKhipuTheme: true });
    queryRawMock.mockResolvedValueOnce([
      {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
        floatingKhipuTheme: "dark",
      },
    ]);

    await expect(getUserSettings("dark-theme")).resolves.toEqual({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: DEFAULT_DATE_FORMAT,
      appTheme: DEFAULT_APP_THEME,
      defaultViewMode: DEFAULT_VIEW_MODE,
      excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
      excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
      aiProviderPreference: "auto",
      floatingKhipuProvider: FLOATING_KHIPU_DEFAULTS.provider,
      floatingKhipuWidth: FLOATING_KHIPU_DEFAULTS.width,
      floatingKhipuHeight: FLOATING_KHIPU_DEFAULTS.height,
      floatingKhipuFontSize: FLOATING_KHIPU_DEFAULTS.fontSize,
      floatingKhipuPosition: FLOATING_KHIPU_DEFAULTS.position,
      floatingKhipuTheme: "dark",
    });
  });

  it("falls back to light theme for unrecognized value", async () => {
    mockUserSettingsColumnSupport({ floatingKhipuTheme: true });
    queryRawMock.mockResolvedValueOnce([
      {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
        floatingKhipuTheme: "blue",
      },
    ]);

    await expect(getUserSettings("bad-theme")).resolves.toMatchObject({
      floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
    });
  });

  it("persists dark theme via updateUserSettings", async () => {
    mockUserSettingsColumnChecks({ floatingKhipuTheme: true });
    queryRawMock.mockResolvedValueOnce([
      {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
        floatingKhipuTheme: "dark",
      },
    ]);

    await expect(
      updateUserSettings("theme-write", {
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: DEFAULT_DATE_FORMAT,
        appTheme: DEFAULT_APP_THEME,
        defaultViewMode: DEFAULT_VIEW_MODE,
        excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
        excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
        aiProviderPreference: "auto",
        floatingKhipuProvider: FLOATING_KHIPU_DEFAULTS.provider,
        floatingKhipuWidth: FLOATING_KHIPU_DEFAULTS.width,
        floatingKhipuHeight: FLOATING_KHIPU_DEFAULTS.height,
        floatingKhipuFontSize: FLOATING_KHIPU_DEFAULTS.fontSize,
        floatingKhipuPosition: FLOATING_KHIPU_DEFAULTS.position,
        floatingKhipuTheme: "dark",
      }),
    ).resolves.toMatchObject({
      floatingKhipuTheme: "dark",
    });
  });

  // ─── agentModel column guard (regression: Khipu Agente "no guarda la selección") ──────
  //
  // BUGFIX: cuando la migración `20260714000000_add_agent_model_to_user_settings`
  // NO se ha aplicado, hasUserSettingsColumn('agentModel') devuelve false y el
  // upsert omitía silenciosamente el campo → PUT retornaba 200 sin persistir.
  // Estos tests pinnean el guard que lanza un error explícito con el nombre
  // exacto de la migración que el dev/admin debe correr.
  describe("updateAiProviderSettings agentModel column guard", () => {
    it("lanza error claro cuando la columna agentModel no existe (migración no aplicada)", async () => {
      // Todas las columnas AI devuelven exists:false (incluyendo agentModel).
      queryRawMock.mockResolvedValue([{ exists: false }]);

      await expect(
        updateAiProviderSettings("user-bug", {
          aiProviderPreference: "auto",
          agentModel: "google/gemini-2.5-flash",
        }),
      ).rejects.toThrow(
        /agentModel aún no puede guardarse.*20260714000000_add_agent_model_to_user_settings.*npx prisma migrate deploy/s,
      );
    });

    it("lanza error cuando agentModel es null pero la columna no existe (intento explícito de limpieza)", async () => {
      queryRawMock.mockResolvedValue([{ exists: false }]);

      await expect(
        updateAiProviderSettings("user-bug", {
          aiProviderPreference: "auto",
          agentModel: null,
        }),
      ).rejects.toThrow(/agentModel aún no puede guardarse/);
    });

    it("lanza error cuando agentModel es string vacío y la columna no existe", async () => {
      queryRawMock.mockResolvedValue([{ exists: false }]);

      await expect(
        updateAiProviderSettings("user-bug", {
          aiProviderPreference: "auto",
          agentModel: "",
        }),
      ).rejects.toThrow(/agentModel aún no puede guardarse/);
    });

    it("NO lanza error cuando agentModel está ausente en el input (caller no quiso cambiarlo)", async () => {
      // Caso cloud-ai-settings-card que NO envía agentModel. Aunque la columna
      // agentModel no exista, este guardado puntual debe proceder (los demás
      // campos sí se persisten) — el guard solo debe dispararse cuando el
      // caller tiene intención explícita de modificar agentModel.
      //
      // El throw solo se dispara si `input.agentModel !== undefined`. Si un
      // refactor futuro cambia a `input.agentModel != null` (que matchea
      // undefined), TODOS los PUTs tirarían — incluyendo cloud-ai-settings-card.
      // Este test pinnean esa regresión.

      // Todas las columnas AI devuelven exists:false (incluyendo agentModel).
      queryRawMock.mockResolvedValue([{ exists: false }]);

      // Mock del upsert para que devuelva la fila que el caller quería
      // persistir (openaiModel diferente al default).
      upsertMock.mockResolvedValueOnce({
        id: "row-1",
        userId: "user-bug",
        aiProviderPreference: "auto",
        openaiModel: "custom-openai-model",
      });

      // Pasamos un objeto SIN la propiedad agentModel en absoluto
      const result = await updateAiProviderSettings("user-bug", {
        aiProviderPreference: "auto",
        openaiModel: "custom-openai-model",
      });

      // Si llegamos aquí sin throw, el guard respetó la semántica "solo si
      // el caller incluyó agentModel". El upsert se llamó con openaiModel
      // en el payload (aunque !supportsOpenaiModel hará que se filtre).
      expect(result.aiProviderPreference).toBe("auto");
      expect(result.openaiModel).toBe("custom-openai-model");
    });
  });
});
