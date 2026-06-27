import { cache } from "react";
import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { userSettingsSchema, type UserSettingsInput } from "@/lib/validations/settings";
import { encryptApiKey, decryptApiKey, maskApiKey } from "@/lib/ai/encryption";
import {
  DEFAULT_APP_THEME,
  DEFAULT_DATE_FORMAT,
  DEFAULT_EXCEL_ROW_HEIGHT,
  DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
  DEFAULT_INITIAL_SUB_BUDGET_NAMES,
  DEFAULT_VIEW_MODE,
  FLOATING_KHIPU_DEFAULTS,
  type AiProviderPreference,
  type FloatingKhipuFontSize,
  type FloatingKhipuPosition,
  type FloatingKhipuTheme,
  type UserSettingsRecord,
} from "@/types/settings";
import { z } from "zod";

export const USER_SETTINGS_CACHE_TAG = "user-settings";

const isTestEnvironment = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

export const defaultUserSettings: UserSettingsRecord = {
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
};

const userSettingsStoredRowSchema = z.object({
  defaultCurrency: userSettingsSchema.shape.defaultCurrency,
  currencyDecimals: userSettingsSchema.shape.currencyDecimals,
  dateFormat: userSettingsSchema.shape.dateFormat,
  appTheme: userSettingsSchema.shape.appTheme,
  defaultViewMode: userSettingsSchema.shape.defaultViewMode,
  excelShowFieldBorders: userSettingsSchema.shape.excelShowFieldBorders,
  excelRowHeight: userSettingsSchema.shape.excelRowHeight,
  defaultIgvRate: userSettingsSchema.shape.defaultIgvRate,
  defaultGeneralExpensesRate: userSettingsSchema.shape.defaultGeneralExpensesRate,
  defaultUtilityRate: userSettingsSchema.shape.defaultUtilityRate,
  defaultSubBudgetNames: userSettingsSchema.shape.defaultSubBudgetNames,
});

export type AiProviderSettingsInput = {
  aiProviderPreference: AiProviderPreference;
  openaiApiKey?: string | null;
  geminiApiKey?: string | null;
  openaiModel?: string | null;
  geminiModel?: string | null;
};

export type AiProviderSettings = {
  aiProviderPreference: AiProviderPreference;
  openaiApiKeyMasked: string;
  geminiApiKeyMasked: string;
  openaiModel: string;
  geminiModel: string;
  openaiConfigured: boolean;
  geminiConfigured: boolean;
};

function createDefaultUserSettings(): UserSettingsRecord {
  return { ...defaultUserSettings };
}

function normalizeRateValue(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  return value;
}

function normalizeUserSettingsRateFields(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    dateFormat: row.dateFormat,
    appTheme: row.appTheme,
    defaultViewMode: row.defaultViewMode,
    excelShowFieldBorders: row.excelShowFieldBorders,
    excelRowHeight: row.excelRowHeight,
    defaultIgvRate: normalizeRateValue(row.defaultIgvRate),
    defaultGeneralExpensesRate: normalizeRateValue(row.defaultGeneralExpensesRate),
    defaultUtilityRate: normalizeRateValue(row.defaultUtilityRate),
    defaultSubBudgetNames: row.defaultSubBudgetNames,
  };
}

function readAiProviderPreference(value: unknown): AiProviderPreference {
  if (typeof value === "string" && ["auto", "ollama", "chatgpt_bridge", "openai", "gemini", "openrouter"].includes(value)) {
    return value as AiProviderPreference;
  }
  return "auto";
}

function readFloatingKhipuProvider(value: unknown): AiProviderPreference {
  if (typeof value === "string" && ["auto", "ollama", "chatgpt_bridge", "openai", "gemini", "openrouter"].includes(value)) {
    return value as AiProviderPreference;
  }
  return FLOATING_KHIPU_DEFAULTS.provider;
}

function readFloatingKhipuFontSize(value: unknown): FloatingKhipuFontSize {
  if (typeof value === "string" && ["compact", "normal", "large"].includes(value)) {
    return value as FloatingKhipuFontSize;
  }
  return FLOATING_KHIPU_DEFAULTS.fontSize;
}

function readFloatingKhipuPosition(value: unknown): FloatingKhipuPosition {
  if (typeof value === "string" && ["bottom-right", "bottom-left", "top-right", "top-left"].includes(value)) {
    return value as FloatingKhipuPosition;
  }
  return FLOATING_KHIPU_DEFAULTS.position;
}

function readFloatingKhipuTheme(value: unknown): FloatingKhipuTheme {
  if (typeof value === "string" && ["light", "dark"].includes(value)) {
    return value as FloatingKhipuTheme;
  }
  return FLOATING_KHIPU_DEFAULTS.theme;
}

function readAppTheme(value: unknown): NonNullable<UserSettingsRecord["appTheme"]> {
  if (value === "light" || value === "dark") {
    return value;
  }
  return DEFAULT_APP_THEME;
}

function readFloatingKhipuDimension(value: unknown, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return Math.round(parsed);
  return fallback;
}

function normalizeUserSettingsRow(row: unknown): UserSettingsRecord {
  if (!row || typeof row !== "object") {
    return createDefaultUserSettings();
  }

  const rowRecord = normalizeUserSettingsRateFields(row as Record<string, unknown>);
  const defaultCurrency = userSettingsSchema.shape.defaultCurrency.safeParse(rowRecord.defaultCurrency);
  const currencyDecimals = userSettingsSchema.shape.currencyDecimals.safeParse(rowRecord.currencyDecimals);
  const dateFormat = userSettingsSchema.shape.dateFormat.safeParse(rowRecord.dateFormat);
  const appTheme = userSettingsSchema.shape.appTheme.safeParse(rowRecord.appTheme);
  const defaultViewMode = userSettingsSchema.shape.defaultViewMode.safeParse(rowRecord.defaultViewMode);
  const excelShowFieldBorders = userSettingsSchema.shape.excelShowFieldBorders.safeParse(rowRecord.excelShowFieldBorders);
  const excelRowHeight = userSettingsSchema.shape.excelRowHeight.safeParse(rowRecord.excelRowHeight);
  const defaultIgvRate = userSettingsSchema.shape.defaultIgvRate.safeParse(rowRecord.defaultIgvRate);
  const defaultGeneralExpensesRate = userSettingsSchema.shape.defaultGeneralExpensesRate.safeParse(
    rowRecord.defaultGeneralExpensesRate,
  );
  const defaultUtilityRate = userSettingsSchema.shape.defaultUtilityRate.safeParse(rowRecord.defaultUtilityRate);
  const defaultSubBudgetNames = userSettingsSchema.shape.defaultSubBudgetNames.safeParse(rowRecord.defaultSubBudgetNames);

  return {
    defaultCurrency: defaultCurrency.success ? defaultCurrency.data : defaultUserSettings.defaultCurrency,
    currencyDecimals: currencyDecimals.success ? currencyDecimals.data : defaultUserSettings.currencyDecimals,
    dateFormat: dateFormat.success ? dateFormat.data : defaultUserSettings.dateFormat,
    appTheme: appTheme.success ? appTheme.data : readAppTheme(rowRecord.appTheme),
    defaultViewMode: defaultViewMode.success ? defaultViewMode.data : defaultUserSettings.defaultViewMode,
    excelShowFieldBorders: excelShowFieldBorders.success ? excelShowFieldBorders.data : defaultUserSettings.excelShowFieldBorders,
    excelRowHeight: excelRowHeight.success ? excelRowHeight.data : defaultUserSettings.excelRowHeight,
    defaultIgvRate: defaultIgvRate.success ? defaultIgvRate.data : defaultUserSettings.defaultIgvRate,
    defaultGeneralExpensesRate: defaultGeneralExpensesRate.success
      ? defaultGeneralExpensesRate.data
      : defaultUserSettings.defaultGeneralExpensesRate,
    defaultUtilityRate: defaultUtilityRate.success ? defaultUtilityRate.data : defaultUserSettings.defaultUtilityRate,
    defaultSubBudgetNames: defaultSubBudgetNames.success
      ? defaultSubBudgetNames.data
      : defaultUserSettings.defaultSubBudgetNames,
    aiProviderPreference: readAiProviderPreference(rowRecord.aiProviderPreference),
    floatingKhipuProvider: readFloatingKhipuProvider(rowRecord.floatingKhipuProvider),
    floatingKhipuWidth: readFloatingKhipuDimension(rowRecord.floatingKhipuWidth, FLOATING_KHIPU_DEFAULTS.width),
    floatingKhipuHeight: readFloatingKhipuDimension(rowRecord.floatingKhipuHeight, FLOATING_KHIPU_DEFAULTS.height),
    floatingKhipuFontSize: readFloatingKhipuFontSize(rowRecord.floatingKhipuFontSize),
    floatingKhipuPosition: readFloatingKhipuPosition(rowRecord.floatingKhipuPosition),
    floatingKhipuTheme: readFloatingKhipuTheme(rowRecord.floatingKhipuTheme),
  };
}

function parseStoredUserSettingsRow(row: unknown): UserSettingsRecord {
  if (!row || typeof row !== "object") {
    throw new Error("Failed to persist user settings");
  }

  const parsedRow = userSettingsStoredRowSchema.safeParse(normalizeUserSettingsRateFields(row as Record<string, unknown>));

  if (!parsedRow.success) {
    throw new Error("Failed to persist user settings");
  }

  const rowRecord = row as Record<string, unknown>;

  return {
    ...parsedRow.data,
    aiProviderPreference: readAiProviderPreference(rowRecord.aiProviderPreference),
    floatingKhipuProvider: readFloatingKhipuProvider(rowRecord.floatingKhipuProvider),
    floatingKhipuWidth: readFloatingKhipuDimension(rowRecord.floatingKhipuWidth, FLOATING_KHIPU_DEFAULTS.width),
    floatingKhipuHeight: readFloatingKhipuDimension(rowRecord.floatingKhipuHeight, FLOATING_KHIPU_DEFAULTS.height),
    floatingKhipuFontSize: readFloatingKhipuFontSize(rowRecord.floatingKhipuFontSize),
    floatingKhipuPosition: readFloatingKhipuPosition(rowRecord.floatingKhipuPosition),
    floatingKhipuTheme: readFloatingKhipuTheme(rowRecord.floatingKhipuTheme),
  };
}

const columnExistsRowSchema = z.object({
  exists: z.boolean(),
});

const _hasUserSettingsColumn = async (columnName: string) => {
  const [result] = await prisma.$queryRaw<Array<unknown>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
      AND table_name = 'UserSettings'
      AND column_name = ${columnName}
    ) AS "exists"
  `;

  const parsedResult = columnExistsRowSchema.safeParse(result);

  return parsedResult.success ? parsedResult.data.exists : false;
}

// Memoize column existence checks — column structure doesn't change during the server's lifetime
const hasUserSettingsColumn = cache(async (columnName: string) => {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true"
    ? _hasUserSettingsColumn(columnName)
    : unstable_cache(
        async (col: string) => _hasUserSettingsColumn(col),
        ["user-settings-columns", columnName],
      )(columnName);
});

const aiProviderColumns = [
  "openaiApiKey",
  "openaiModel",
  "geminiApiKey",
  "geminiModel",
  "aiProviderPreference",
] as const;

export async function getAiProviderSettings(userId: string): Promise<AiProviderSettings> {
  const columnFlags = await Promise.all(
    aiProviderColumns.map((column) => hasUserSettingsColumn(column)),
  );
  const [supportsOpenaiApiKey, supportsOpenaiModel, supportsGeminiApiKey, supportsGeminiModel, supportsAiProviderPreference] = columnFlags;

  const hasAnyAiColumn = columnFlags.some(Boolean);

  if (!hasAnyAiColumn) {
    return {
      aiProviderPreference: "auto",
      openaiApiKeyMasked: "",
      geminiApiKeyMasked: "",
      openaiModel: "",
      geminiModel: "",
      openaiConfigured: false,
      geminiConfigured: false,
    };
  }

  const [settings] = await prisma.$queryRaw<Array<unknown>>`
    SELECT
      ${supportsAiProviderPreference ? Prisma.sql`"aiProviderPreference",` : Prisma.empty}
      ${supportsOpenaiApiKey ? Prisma.sql`"openaiApiKey",` : Prisma.empty}
      ${supportsGeminiApiKey ? Prisma.sql`"geminiApiKey",` : Prisma.empty}
      ${supportsOpenaiModel ? Prisma.sql`"openaiModel",` : Prisma.empty}
      ${supportsGeminiModel ? Prisma.sql`"geminiModel"` : Prisma.empty}
    FROM "UserSettings"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;

  if (!settings || typeof settings !== "object") {
    return {
      aiProviderPreference: "auto",
      openaiApiKeyMasked: "",
      geminiApiKeyMasked: "",
      openaiModel: "",
      geminiModel: "",
      openaiConfigured: false,
      geminiConfigured: false,
    };
  }

  const row = settings as Record<string, unknown>;
  const encryptedOpenaiKey = supportsOpenaiApiKey && typeof row.openaiApiKey === "string" ? row.openaiApiKey : "";
  const encryptedGeminiKey = supportsGeminiApiKey && typeof row.geminiApiKey === "string" ? row.geminiApiKey : "";
  const decryptedOpenaiKey = encryptedOpenaiKey ? decryptApiKey(encryptedOpenaiKey) : "";
  const decryptedGeminiKey = encryptedGeminiKey ? decryptApiKey(encryptedGeminiKey) : "";
  const openaiModel = supportsOpenaiModel && typeof row.openaiModel === "string" ? row.openaiModel : "";
  const geminiModel = supportsGeminiModel && typeof row.geminiModel === "string" ? row.geminiModel : "";

  return {
    aiProviderPreference: readAiProviderPreference(supportsAiProviderPreference ? row.aiProviderPreference : undefined),
    openaiApiKeyMasked: maskApiKey(decryptedOpenaiKey),
    geminiApiKeyMasked: maskApiKey(decryptedGeminiKey),
    openaiModel,
    geminiModel,
    openaiConfigured: decryptedOpenaiKey.length > 0,
    geminiConfigured: decryptedGeminiKey.length > 0,
  };
}

export async function getDecryptedOpenaiApiKey(userId: string): Promise<string> {
  const [supportsOpenaiApiKey] = await Promise.all([hasUserSettingsColumn("openaiApiKey")]);

  if (!supportsOpenaiApiKey) return "";

  const [settings] = await prisma.$queryRaw<Array<unknown>>`
    SELECT "openaiApiKey" FROM "UserSettings" WHERE "userId" = ${userId} LIMIT 1
  `;

  if (!settings || typeof settings !== "object") return "";
  const row = settings as Record<string, unknown>;
  const encrypted = typeof row.openaiApiKey === "string" ? row.openaiApiKey : "";
  return encrypted ? decryptApiKey(encrypted) : "";
}

export async function getDecryptedGeminiApiKey(userId: string): Promise<string> {
  const [supportsGeminiApiKey] = await Promise.all([hasUserSettingsColumn("geminiApiKey")]);

  if (!supportsGeminiApiKey) return "";

  const [settings] = await prisma.$queryRaw<Array<unknown>>`
    SELECT "geminiApiKey" FROM "UserSettings" WHERE "userId" = ${userId} LIMIT 1
  `;

  if (!settings || typeof settings !== "object") return "";
  const row = settings as Record<string, unknown>;
  const encrypted = typeof row.geminiApiKey === "string" ? row.geminiApiKey : "";
  return encrypted ? decryptApiKey(encrypted) : "";
}

export async function updateAiProviderSettings(
  userId: string,
  input: AiProviderSettingsInput,
): Promise<AiProviderSettings> {
  const columnFlags = await Promise.all(
    aiProviderColumns.map((column) => hasUserSettingsColumn(column)),
  );
  const [supportsOpenaiApiKey, supportsOpenaiModel, supportsGeminiApiKey, supportsGeminiModel, supportsAiProviderPreference] = columnFlags;

  const encryptedOpenaiKey = input.openaiApiKey && input.openaiApiKey.trim().length > 0
    ? encryptApiKey(input.openaiApiKey.trim())
    : input.openaiApiKey === "" ? "" : undefined;
  const encryptedGeminiKey = input.geminiApiKey && input.geminiApiKey.trim().length > 0
    ? encryptApiKey(input.geminiApiKey.trim())
    : input.geminiApiKey === "" ? "" : undefined;

  const [settings] = await prisma.$queryRaw<Array<unknown>>`
    INSERT INTO "UserSettings" (
      "id",
      "userId",
      "defaultCurrency",
      "currencyDecimals",
      "defaultIgvRate",
      "defaultGeneralExpensesRate",
      "defaultUtilityRate",
      ${supportsAiProviderPreference ? Prisma.sql`"aiProviderPreference",` : Prisma.empty}
      ${supportsOpenaiApiKey && encryptedOpenaiKey !== undefined ? Prisma.sql`"openaiApiKey",` : Prisma.empty}
      ${supportsGeminiApiKey && encryptedGeminiKey !== undefined ? Prisma.sql`"geminiApiKey",` : Prisma.empty}
      ${supportsOpenaiModel ? Prisma.sql`"openaiModel",` : Prisma.empty}
      ${supportsGeminiModel ? Prisma.sql`"geminiModel",` : Prisma.empty}
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${userId},
      ${"PEN"},
      ${2},
      ${0.18},
      ${0.10},
      ${0.08},
      ${supportsAiProviderPreference ? Prisma.sql`${input.aiProviderPreference},` : Prisma.empty}
      ${supportsOpenaiApiKey && encryptedOpenaiKey !== undefined ? Prisma.sql`${encryptedOpenaiKey},` : Prisma.empty}
      ${supportsGeminiApiKey && encryptedGeminiKey !== undefined ? Prisma.sql`${encryptedGeminiKey},` : Prisma.empty}
      ${supportsOpenaiModel ? Prisma.sql`${input.openaiModel ?? null},` : Prisma.empty}
      ${supportsGeminiModel ? Prisma.sql`${input.geminiModel ?? null},` : Prisma.empty}
      NOW(),
      NOW()
    )
    ON CONFLICT ("userId")
    DO UPDATE SET
      ${supportsAiProviderPreference ? Prisma.sql`"aiProviderPreference" = EXCLUDED."aiProviderPreference",` : Prisma.empty}
      ${supportsOpenaiApiKey && encryptedOpenaiKey !== undefined ? Prisma.sql`"openaiApiKey" = EXCLUDED."openaiApiKey",` : Prisma.empty}
      ${supportsGeminiApiKey && encryptedGeminiKey !== undefined ? Prisma.sql`"geminiApiKey" = EXCLUDED."geminiApiKey",` : Prisma.empty}
      ${supportsOpenaiModel ? Prisma.sql`"openaiModel" = EXCLUDED."openaiModel",` : Prisma.empty}
      ${supportsGeminiModel ? Prisma.sql`"geminiModel" = EXCLUDED."geminiModel",` : Prisma.empty}
      "updatedAt" = NOW()
    RETURNING
      ${supportsAiProviderPreference ? Prisma.sql`"aiProviderPreference",` : Prisma.empty}
      ${supportsOpenaiApiKey ? Prisma.sql`"openaiApiKey",` : Prisma.empty}
      ${supportsGeminiApiKey ? Prisma.sql`"geminiApiKey",` : Prisma.empty}
      ${supportsOpenaiModel ? Prisma.sql`"openaiModel",` : Prisma.empty}
      ${supportsGeminiModel ? Prisma.sql`"geminiModel"` : Prisma.empty}
  `;

  const row = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
  const storedEncryptedOpenaiKey = supportsOpenaiApiKey && typeof row.openaiApiKey === "string" ? row.openaiApiKey : "";
  const storedEncryptedGeminiKey = supportsGeminiApiKey && typeof row.geminiApiKey === "string" ? row.geminiApiKey : "";
  const storedDecryptedOpenai = storedEncryptedOpenaiKey ? decryptApiKey(storedEncryptedOpenaiKey) : "";
  const storedDecryptedGemini = storedEncryptedGeminiKey ? decryptApiKey(storedEncryptedGeminiKey) : "";

  return {
    aiProviderPreference: readAiProviderPreference(supportsAiProviderPreference ? row.aiProviderPreference : input.aiProviderPreference),
    openaiApiKeyMasked: maskApiKey(storedDecryptedOpenai),
    geminiApiKeyMasked: maskApiKey(storedDecryptedGemini),
    openaiModel: supportsOpenaiModel && typeof row.openaiModel === "string" ? row.openaiModel : input.openaiModel ?? "",
    geminiModel: supportsGeminiModel && typeof row.geminiModel === "string" ? row.geminiModel : input.geminiModel ?? "",
    openaiConfigured: storedDecryptedOpenai.length > 0,
    geminiConfigured: storedDecryptedGemini.length > 0,
  };
}

const _getUserSettings = async (userId: string): Promise<UserSettingsRecord> => {
  const [
    supportsDefaultSubBudgetNames, supportsDateFormat, supportsAppTheme, supportsDefaultViewMode,
    supportsExcelShowFieldBorders, supportsExcelRowHeight, supportsAiProviderPreference,
    supportsFloatingKhipuProvider, supportsFloatingKhipuWidth, supportsFloatingKhipuHeight,
    supportsFloatingKhipuFontSize,    supportsFloatingKhipuPosition, supportsFloatingKhipuTheme,
  ] = await Promise.all([
    hasUserSettingsColumn("defaultSubBudgetNames"),
    hasUserSettingsColumn("dateFormat"),
    hasUserSettingsColumn("appTheme"),
    hasUserSettingsColumn("defaultViewMode"),
    hasUserSettingsColumn("excelShowFieldBorders"),
    hasUserSettingsColumn("excelRowHeight"),
    hasUserSettingsColumn("aiProviderPreference"),
    hasUserSettingsColumn("floatingKhipuProvider"),
    hasUserSettingsColumn("floatingKhipuWidth"),
    hasUserSettingsColumn("floatingKhipuHeight"),
    hasUserSettingsColumn("floatingKhipuFontSize"),
    hasUserSettingsColumn("floatingKhipuPosition"),
    hasUserSettingsColumn("floatingKhipuTheme"),
  ]);

  if (supportsDefaultSubBudgetNames && supportsDateFormat && supportsAppTheme && supportsDefaultViewMode && supportsExcelShowFieldBorders && supportsExcelRowHeight) {
    const [settings] = await prisma.$queryRaw<Array<unknown>>`
      SELECT "defaultCurrency", "currencyDecimals", "dateFormat", "appTheme", "defaultViewMode", "excelShowFieldBorders", "excelRowHeight", "defaultIgvRate", "defaultGeneralExpensesRate", "defaultUtilityRate"
      , "defaultSubBudgetNames"
      ${supportsAiProviderPreference ? Prisma.sql`, "aiProviderPreference"` : Prisma.empty}
      ${supportsFloatingKhipuProvider ? Prisma.sql`, "floatingKhipuProvider"` : Prisma.empty}
      ${supportsFloatingKhipuWidth ? Prisma.sql`, "floatingKhipuWidth"` : Prisma.empty}
      ${supportsFloatingKhipuHeight ? Prisma.sql`, "floatingKhipuHeight"` : Prisma.empty}
      ${supportsFloatingKhipuFontSize ? Prisma.sql`, "floatingKhipuFontSize"` : Prisma.empty}
      ${supportsFloatingKhipuPosition ? Prisma.sql`, "floatingKhipuPosition"` : Prisma.empty}
      ${supportsFloatingKhipuTheme ? Prisma.sql`, "floatingKhipuTheme"` : Prisma.empty}
      FROM "UserSettings"
      WHERE "userId" = ${userId}
      LIMIT 1
    `;

    return normalizeUserSettingsRow(settings);
  }

  const [settings] = await prisma.$queryRaw<Array<unknown>>`
    SELECT "defaultCurrency", "currencyDecimals"
    ${supportsDateFormat ? Prisma.sql`, "dateFormat"` : Prisma.empty}
    ${supportsAppTheme ? Prisma.sql`, "appTheme"` : Prisma.empty}
    ${supportsDefaultViewMode ? Prisma.sql`, "defaultViewMode"` : Prisma.empty}
    ${supportsExcelShowFieldBorders ? Prisma.sql`, "excelShowFieldBorders"` : Prisma.empty}
    ${supportsExcelRowHeight ? Prisma.sql`, "excelRowHeight"` : Prisma.empty}
    , "defaultIgvRate", "defaultGeneralExpensesRate", "defaultUtilityRate"
    ${supportsDefaultSubBudgetNames ? Prisma.sql`, "defaultSubBudgetNames"` : Prisma.empty}
    ${supportsAiProviderPreference ? Prisma.sql`, "aiProviderPreference"` : Prisma.empty}
    ${supportsFloatingKhipuProvider ? Prisma.sql`, "floatingKhipuProvider"` : Prisma.empty}
    ${supportsFloatingKhipuWidth ? Prisma.sql`, "floatingKhipuWidth"` : Prisma.empty}
    ${supportsFloatingKhipuHeight ? Prisma.sql`, "floatingKhipuHeight"` : Prisma.empty}
    ${supportsFloatingKhipuFontSize ? Prisma.sql`, "floatingKhipuFontSize"` : Prisma.empty}
    ${supportsFloatingKhipuPosition ? Prisma.sql`, "floatingKhipuPosition"` : Prisma.empty}
    ${supportsFloatingKhipuTheme ? Prisma.sql`, "floatingKhipuTheme"` : Prisma.empty}
    FROM "UserSettings"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;

  if (!settings) {
    return {
      ...defaultUserSettings,
    };
  }

  return normalizeUserSettingsRow({
    ...settings,
    dateFormat: supportsDateFormat && typeof (settings as Record<string, unknown>).dateFormat !== "undefined"
      ? (settings as Record<string, unknown>).dateFormat
      : DEFAULT_DATE_FORMAT,
    appTheme: supportsAppTheme && typeof (settings as Record<string, unknown>).appTheme !== "undefined"
      ? (settings as Record<string, unknown>).appTheme
      : DEFAULT_APP_THEME,
    defaultViewMode: supportsDefaultViewMode && typeof (settings as Record<string, unknown>).defaultViewMode !== "undefined"
      ? (settings as Record<string, unknown>).defaultViewMode
      : DEFAULT_VIEW_MODE,
    excelShowFieldBorders: supportsExcelShowFieldBorders && typeof (settings as Record<string, unknown>).excelShowFieldBorders !== "undefined"
      ? (settings as Record<string, unknown>).excelShowFieldBorders
      : DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
    excelRowHeight: supportsExcelRowHeight && typeof (settings as Record<string, unknown>).excelRowHeight !== "undefined"
      ? (settings as Record<string, unknown>).excelRowHeight
      : DEFAULT_EXCEL_ROW_HEIGHT,
    defaultSubBudgetNames: supportsDefaultSubBudgetNames && typeof (settings as Record<string, unknown>).defaultSubBudgetNames !== "undefined"
      ? (settings as Record<string, unknown>).defaultSubBudgetNames
      : DEFAULT_INITIAL_SUB_BUDGET_NAMES,
  });
};

export const getUserSettings = cache(
  async (userId: string): Promise<UserSettingsRecord> => {
    if (isTestEnvironment) {
      return _getUserSettings(userId);
    }

    return unstable_cache(
      async (uid: string) => _getUserSettings(uid),
      [USER_SETTINGS_CACHE_TAG],
      { tags: [USER_SETTINGS_CACHE_TAG] },
    )(userId);
  },
);

export async function updateUserSettings(userId: string, input: UserSettingsInput): Promise<UserSettingsRecord> {
  const data = userSettingsSchema.parse(input);
  const [
    supportsDefaultSubBudgetNames, supportsDateFormat, supportsAppTheme, supportsDefaultViewMode,
    supportsExcelShowFieldBorders, supportsExcelRowHeight, supportsAiProviderPreference,
    supportsFloatingKhipuProvider, supportsFloatingKhipuWidth, supportsFloatingKhipuHeight,
    supportsFloatingKhipuFontSize, supportsFloatingKhipuPosition, supportsFloatingKhipuTheme,
  ] = await Promise.all([
    hasUserSettingsColumn("defaultSubBudgetNames"),
    hasUserSettingsColumn("dateFormat"),
    hasUserSettingsColumn("appTheme"),
    hasUserSettingsColumn("defaultViewMode"),
    hasUserSettingsColumn("excelShowFieldBorders"),
    hasUserSettingsColumn("excelRowHeight"),
    hasUserSettingsColumn("aiProviderPreference"),
    hasUserSettingsColumn("floatingKhipuProvider"),
    hasUserSettingsColumn("floatingKhipuWidth"),
    hasUserSettingsColumn("floatingKhipuHeight"),
    hasUserSettingsColumn("floatingKhipuFontSize"),
    hasUserSettingsColumn("floatingKhipuPosition"),
    hasUserSettingsColumn("floatingKhipuTheme"),
  ]);

  if (supportsDefaultSubBudgetNames && supportsDateFormat && supportsAppTheme && supportsDefaultViewMode && supportsExcelShowFieldBorders && supportsExcelRowHeight) {
    const [settings] = await prisma.$queryRaw<Array<unknown>>`
      INSERT INTO "UserSettings" (
        "id",
        "userId",
        "defaultCurrency",
        "currencyDecimals",
        "dateFormat",
        "appTheme",
        "defaultViewMode",
        "excelShowFieldBorders",
        "excelRowHeight",
        "defaultIgvRate",
        "defaultGeneralExpensesRate",
        "defaultUtilityRate",
        "defaultSubBudgetNames",
        ${supportsAiProviderPreference ? Prisma.sql`"aiProviderPreference",` : Prisma.empty}
        ${supportsFloatingKhipuProvider ? Prisma.sql`"floatingKhipuProvider",` : Prisma.empty}
        ${supportsFloatingKhipuWidth ? Prisma.sql`"floatingKhipuWidth",` : Prisma.empty}
        ${supportsFloatingKhipuHeight ? Prisma.sql`"floatingKhipuHeight",` : Prisma.empty}
        ${supportsFloatingKhipuFontSize ? Prisma.sql`"floatingKhipuFontSize",` : Prisma.empty}
        ${supportsFloatingKhipuPosition ? Prisma.sql`"floatingKhipuPosition",` : Prisma.empty}
        ${supportsFloatingKhipuTheme ? Prisma.sql`"floatingKhipuTheme",` : Prisma.empty}
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${userId},
        ${data.defaultCurrency},
        ${data.currencyDecimals},
        ${data.dateFormat},
        ${data.appTheme},
        ${data.defaultViewMode},
        ${data.excelShowFieldBorders},
        ${data.excelRowHeight},
        ${data.defaultIgvRate},
        ${data.defaultGeneralExpensesRate},
        ${data.defaultUtilityRate},
        ${data.defaultSubBudgetNames},
        ${supportsAiProviderPreference ? Prisma.sql`${data.aiProviderPreference},` : Prisma.empty}
        ${supportsFloatingKhipuProvider ? Prisma.sql`${data.floatingKhipuProvider},` : Prisma.empty}
        ${supportsFloatingKhipuWidth ? Prisma.sql`${data.floatingKhipuWidth},` : Prisma.empty}
        ${supportsFloatingKhipuHeight ? Prisma.sql`${data.floatingKhipuHeight},` : Prisma.empty}
        ${supportsFloatingKhipuFontSize ? Prisma.sql`${data.floatingKhipuFontSize},` : Prisma.empty}
        ${supportsFloatingKhipuPosition ? Prisma.sql`${data.floatingKhipuPosition},` : Prisma.empty}
        ${supportsFloatingKhipuTheme ? Prisma.sql`${data.floatingKhipuTheme},` : Prisma.empty}
        NOW(),
        NOW()
      )
      ON CONFLICT ("userId")
      DO UPDATE SET
        "defaultCurrency" = EXCLUDED."defaultCurrency",
        "currencyDecimals" = EXCLUDED."currencyDecimals",
        "dateFormat" = EXCLUDED."dateFormat",
        "appTheme" = EXCLUDED."appTheme",
        "defaultViewMode" = EXCLUDED."defaultViewMode",
        "excelShowFieldBorders" = EXCLUDED."excelShowFieldBorders",
        "excelRowHeight" = EXCLUDED."excelRowHeight",
        "defaultIgvRate" = EXCLUDED."defaultIgvRate",
        "defaultGeneralExpensesRate" = EXCLUDED."defaultGeneralExpensesRate",
        "defaultUtilityRate" = EXCLUDED."defaultUtilityRate",
        "defaultSubBudgetNames" = EXCLUDED."defaultSubBudgetNames",
        ${supportsAiProviderPreference ? Prisma.sql`"aiProviderPreference" = EXCLUDED."aiProviderPreference",` : Prisma.empty}
        ${supportsFloatingKhipuProvider ? Prisma.sql`"floatingKhipuProvider" = EXCLUDED."floatingKhipuProvider",` : Prisma.empty}
        ${supportsFloatingKhipuWidth ? Prisma.sql`"floatingKhipuWidth" = EXCLUDED."floatingKhipuWidth",` : Prisma.empty}
        ${supportsFloatingKhipuHeight ? Prisma.sql`"floatingKhipuHeight" = EXCLUDED."floatingKhipuHeight",` : Prisma.empty}
        ${supportsFloatingKhipuFontSize ? Prisma.sql`"floatingKhipuFontSize" = EXCLUDED."floatingKhipuFontSize",` : Prisma.empty}
        ${supportsFloatingKhipuPosition ? Prisma.sql`"floatingKhipuPosition" = EXCLUDED."floatingKhipuPosition",` : Prisma.empty}
        ${supportsFloatingKhipuTheme ? Prisma.sql`"floatingKhipuTheme" = EXCLUDED."floatingKhipuTheme",` : Prisma.empty}
        "updatedAt" = NOW()
      RETURNING
        "defaultCurrency",
        "currencyDecimals",
        "dateFormat",
        "appTheme",
        "defaultViewMode",
        "excelShowFieldBorders",
        "excelRowHeight",
        "defaultIgvRate",
        "defaultGeneralExpensesRate",
        "defaultUtilityRate",
        "defaultSubBudgetNames"
        ${supportsAiProviderPreference ? Prisma.sql`, "aiProviderPreference"` : Prisma.empty}
        ${supportsFloatingKhipuProvider ? Prisma.sql`, "floatingKhipuProvider"` : Prisma.empty}
        ${supportsFloatingKhipuWidth ? Prisma.sql`, "floatingKhipuWidth"` : Prisma.empty}
        ${supportsFloatingKhipuHeight ? Prisma.sql`, "floatingKhipuHeight"` : Prisma.empty}
        ${supportsFloatingKhipuFontSize ? Prisma.sql`, "floatingKhipuFontSize"` : Prisma.empty}
        ${supportsFloatingKhipuPosition ? Prisma.sql`, "floatingKhipuPosition"` : Prisma.empty}
        ${supportsFloatingKhipuTheme ? Prisma.sql`, "floatingKhipuTheme"` : Prisma.empty}
    `;

    return parseStoredUserSettingsRow(settings);
  }

  const [settings] = await prisma.$queryRaw<Array<unknown>>`
    INSERT INTO "UserSettings" (
      "id",
      "userId",
      "defaultCurrency",
      "currencyDecimals",
      ${supportsDateFormat ? Prisma.sql`"dateFormat",` : Prisma.empty}
      ${supportsAppTheme ? Prisma.sql`"appTheme",` : Prisma.empty}
      ${supportsDefaultViewMode ? Prisma.sql`"defaultViewMode",` : Prisma.empty}
      ${supportsExcelShowFieldBorders ? Prisma.sql`"excelShowFieldBorders",` : Prisma.empty}
      ${supportsExcelRowHeight ? Prisma.sql`"excelRowHeight",` : Prisma.empty}
      "defaultIgvRate",
      "defaultGeneralExpensesRate",
      "defaultUtilityRate",
      ${supportsAiProviderPreference ? Prisma.sql`"aiProviderPreference",` : Prisma.empty}
      ${supportsFloatingKhipuProvider ? Prisma.sql`"floatingKhipuProvider",` : Prisma.empty}
      ${supportsFloatingKhipuWidth ? Prisma.sql`"floatingKhipuWidth",` : Prisma.empty}
      ${supportsFloatingKhipuHeight ? Prisma.sql`"floatingKhipuHeight",` : Prisma.empty}
      ${supportsFloatingKhipuFontSize ? Prisma.sql`"floatingKhipuFontSize",` : Prisma.empty}
      ${supportsFloatingKhipuPosition ? Prisma.sql`"floatingKhipuPosition",` : Prisma.empty}
      ${supportsFloatingKhipuTheme ? Prisma.sql`"floatingKhipuTheme",` : Prisma.empty}
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${userId},
      ${data.defaultCurrency},
      ${data.currencyDecimals},
      ${supportsDateFormat ? Prisma.sql`${data.dateFormat},` : Prisma.empty}
      ${supportsAppTheme ? Prisma.sql`${data.appTheme},` : Prisma.empty}
      ${supportsDefaultViewMode ? Prisma.sql`${data.defaultViewMode},` : Prisma.empty}
      ${supportsExcelShowFieldBorders ? Prisma.sql`${data.excelShowFieldBorders},` : Prisma.empty}
      ${supportsExcelRowHeight ? Prisma.sql`${data.excelRowHeight},` : Prisma.empty}
      ${data.defaultIgvRate},
      ${data.defaultGeneralExpensesRate},
      ${data.defaultUtilityRate},
      ${supportsAiProviderPreference ? Prisma.sql`${data.aiProviderPreference},` : Prisma.empty}
      ${supportsFloatingKhipuProvider ? Prisma.sql`${data.floatingKhipuProvider},` : Prisma.empty}
      ${supportsFloatingKhipuWidth ? Prisma.sql`${data.floatingKhipuWidth},` : Prisma.empty}
      ${supportsFloatingKhipuHeight ? Prisma.sql`${data.floatingKhipuHeight},` : Prisma.empty}
      ${supportsFloatingKhipuFontSize ? Prisma.sql`${data.floatingKhipuFontSize},` : Prisma.empty}
      ${supportsFloatingKhipuPosition ? Prisma.sql`${data.floatingKhipuPosition},` : Prisma.empty}
      ${supportsFloatingKhipuTheme ? Prisma.sql`${data.floatingKhipuTheme},` : Prisma.empty}
      NOW(),
      NOW()
    )
    ON CONFLICT ("userId")
    DO UPDATE SET
      "defaultCurrency" = EXCLUDED."defaultCurrency",
      "currencyDecimals" = EXCLUDED."currencyDecimals",
      ${supportsDateFormat ? Prisma.sql`"dateFormat" = EXCLUDED."dateFormat",` : Prisma.empty}
      ${supportsAppTheme ? Prisma.sql`"appTheme" = EXCLUDED."appTheme",` : Prisma.empty}
      ${supportsDefaultViewMode ? Prisma.sql`"defaultViewMode" = EXCLUDED."defaultViewMode",` : Prisma.empty}
      ${supportsExcelShowFieldBorders ? Prisma.sql`"excelShowFieldBorders" = EXCLUDED."excelShowFieldBorders",` : Prisma.empty}
      ${supportsExcelRowHeight ? Prisma.sql`"excelRowHeight" = EXCLUDED."excelRowHeight",` : Prisma.empty}
      "defaultIgvRate" = EXCLUDED."defaultIgvRate",
      "defaultGeneralExpensesRate" = EXCLUDED."defaultGeneralExpensesRate",
      "defaultUtilityRate" = EXCLUDED."defaultUtilityRate",
      ${supportsAiProviderPreference ? Prisma.sql`"aiProviderPreference" = EXCLUDED."aiProviderPreference",` : Prisma.empty}
      ${supportsFloatingKhipuProvider ? Prisma.sql`"floatingKhipuProvider" = EXCLUDED."floatingKhipuProvider",` : Prisma.empty}
      ${supportsFloatingKhipuWidth ? Prisma.sql`"floatingKhipuWidth" = EXCLUDED."floatingKhipuWidth",` : Prisma.empty}
      ${supportsFloatingKhipuHeight ? Prisma.sql`"floatingKhipuHeight" = EXCLUDED."floatingKhipuHeight",` : Prisma.empty}
      ${supportsFloatingKhipuFontSize ? Prisma.sql`"floatingKhipuFontSize" = EXCLUDED."floatingKhipuFontSize",` : Prisma.empty}
      ${supportsFloatingKhipuPosition ? Prisma.sql`"floatingKhipuPosition" = EXCLUDED."floatingKhipuPosition",` : Prisma.empty}
      ${supportsFloatingKhipuTheme ? Prisma.sql`"floatingKhipuTheme" = EXCLUDED."floatingKhipuTheme",` : Prisma.empty}
      "updatedAt" = NOW()
    RETURNING
      "defaultCurrency",
      "currencyDecimals",
      ${supportsDateFormat ? Prisma.sql`"dateFormat",` : Prisma.empty}
      ${supportsAppTheme ? Prisma.sql`"appTheme",` : Prisma.empty}
      ${supportsDefaultViewMode ? Prisma.sql`"defaultViewMode",` : Prisma.empty}
      ${supportsExcelShowFieldBorders ? Prisma.sql`"excelShowFieldBorders",` : Prisma.empty}
      ${supportsExcelRowHeight ? Prisma.sql`"excelRowHeight",` : Prisma.empty}
      "defaultIgvRate",
      "defaultGeneralExpensesRate",
      "defaultUtilityRate"
      ${supportsAiProviderPreference ? Prisma.sql`, "aiProviderPreference"` : Prisma.empty}
      ${supportsFloatingKhipuProvider ? Prisma.sql`, "floatingKhipuProvider"` : Prisma.empty}
      ${supportsFloatingKhipuWidth ? Prisma.sql`, "floatingKhipuWidth"` : Prisma.empty}
      ${supportsFloatingKhipuHeight ? Prisma.sql`, "floatingKhipuHeight"` : Prisma.empty}
      ${supportsFloatingKhipuFontSize ? Prisma.sql`, "floatingKhipuFontSize"` : Prisma.empty}
      ${supportsFloatingKhipuPosition ? Prisma.sql`, "floatingKhipuPosition"` : Prisma.empty}
      ${supportsFloatingKhipuTheme ? Prisma.sql`, "floatingKhipuTheme"` : Prisma.empty}
  `;

  const storedSettings = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};

  return parseStoredUserSettingsRow({
    ...storedSettings,
    dateFormat: supportsDateFormat && typeof storedSettings.dateFormat !== "undefined" ? storedSettings.dateFormat : data.dateFormat,
    appTheme: supportsAppTheme && typeof storedSettings.appTheme !== "undefined" ? storedSettings.appTheme : data.appTheme,
    defaultViewMode: supportsDefaultViewMode && typeof storedSettings.defaultViewMode !== "undefined"
      ? storedSettings.defaultViewMode
      : data.defaultViewMode,
    excelShowFieldBorders: supportsExcelShowFieldBorders && typeof storedSettings.excelShowFieldBorders !== "undefined"
      ? storedSettings.excelShowFieldBorders
      : data.excelShowFieldBorders,
    excelRowHeight: supportsExcelRowHeight && typeof storedSettings.excelRowHeight !== "undefined"
      ? storedSettings.excelRowHeight
      : data.excelRowHeight,
    defaultSubBudgetNames: data.defaultSubBudgetNames,
  });
}
