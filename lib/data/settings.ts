import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { userSettingsSchema, type UserSettingsInput } from "@/lib/validations/settings";
import { DEFAULT_DATE_FORMAT, DEFAULT_INITIAL_SUB_BUDGET_NAMES, type UserSettingsRecord } from "@/types/settings";
import { z } from "zod";

export const defaultUserSettings: UserSettingsRecord = {
  defaultCurrency: "PEN",
  currencyDecimals: 2,
  dateFormat: DEFAULT_DATE_FORMAT,
  defaultIgvRate: 0.18,
  defaultGeneralExpensesRate: 0.1,
  defaultUtilityRate: 0.08,
  defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
};

const userSettingsStoredRowSchema = z.object({
  defaultCurrency: userSettingsSchema.shape.defaultCurrency,
  currencyDecimals: userSettingsSchema.shape.currencyDecimals,
  dateFormat: userSettingsSchema.shape.dateFormat,
  defaultIgvRate: userSettingsSchema.shape.defaultIgvRate,
  defaultGeneralExpensesRate: userSettingsSchema.shape.defaultGeneralExpensesRate,
  defaultUtilityRate: userSettingsSchema.shape.defaultUtilityRate,
  defaultSubBudgetNames: userSettingsSchema.shape.defaultSubBudgetNames,
});

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
    defaultIgvRate: normalizeRateValue(row.defaultIgvRate),
    defaultGeneralExpensesRate: normalizeRateValue(row.defaultGeneralExpensesRate),
    defaultUtilityRate: normalizeRateValue(row.defaultUtilityRate),
    defaultSubBudgetNames: row.defaultSubBudgetNames,
  };
}

function normalizeUserSettingsRow(row: unknown): UserSettingsRecord {
  if (!row || typeof row !== "object") {
    return createDefaultUserSettings();
  }

  const rowRecord = normalizeUserSettingsRateFields(row as Record<string, unknown>);
  const defaultCurrency = userSettingsSchema.shape.defaultCurrency.safeParse(rowRecord.defaultCurrency);
  const currencyDecimals = userSettingsSchema.shape.currencyDecimals.safeParse(rowRecord.currencyDecimals);
  const dateFormat = userSettingsSchema.shape.dateFormat.safeParse(rowRecord.dateFormat);
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
    defaultIgvRate: defaultIgvRate.success ? defaultIgvRate.data : defaultUserSettings.defaultIgvRate,
    defaultGeneralExpensesRate: defaultGeneralExpensesRate.success
      ? defaultGeneralExpensesRate.data
      : defaultUserSettings.defaultGeneralExpensesRate,
    defaultUtilityRate: defaultUtilityRate.success ? defaultUtilityRate.data : defaultUserSettings.defaultUtilityRate,
    defaultSubBudgetNames: defaultSubBudgetNames.success
      ? defaultSubBudgetNames.data
      : defaultUserSettings.defaultSubBudgetNames,
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

  return parsedRow.data;
}

const columnExistsRowSchema = z.object({
  exists: z.boolean(),
});

async function hasUserSettingsColumn(columnName: string) {
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

export async function getUserSettings(userId: string): Promise<UserSettingsRecord> {
  const [supportsDefaultSubBudgetNames, supportsDateFormat] = await Promise.all([
    hasUserSettingsColumn("defaultSubBudgetNames"),
    hasUserSettingsColumn("dateFormat"),
  ]);

  if (supportsDefaultSubBudgetNames && supportsDateFormat) {
    const [settings] = await prisma.$queryRaw<Array<unknown>>`
      SELECT "defaultCurrency", "currencyDecimals", "dateFormat", "defaultIgvRate", "defaultGeneralExpensesRate", "defaultUtilityRate"
      , "defaultSubBudgetNames"
      FROM "UserSettings"
      WHERE "userId" = ${userId}
      LIMIT 1
    `;

    return normalizeUserSettingsRow(settings);
  }

  const [settings] = await prisma.$queryRaw<Array<unknown>>`
    SELECT "defaultCurrency", "currencyDecimals"
    ${supportsDateFormat ? Prisma.sql`, "dateFormat"` : Prisma.empty}
    , "defaultIgvRate", "defaultGeneralExpensesRate", "defaultUtilityRate"
    ${supportsDefaultSubBudgetNames ? Prisma.sql`, "defaultSubBudgetNames"` : Prisma.empty}
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
    defaultSubBudgetNames: supportsDefaultSubBudgetNames && typeof (settings as Record<string, unknown>).defaultSubBudgetNames !== "undefined"
      ? (settings as Record<string, unknown>).defaultSubBudgetNames
      : DEFAULT_INITIAL_SUB_BUDGET_NAMES,
  });
}

export async function updateUserSettings(userId: string, input: UserSettingsInput): Promise<UserSettingsRecord> {
  const data = userSettingsSchema.parse(input);
  const [supportsDefaultSubBudgetNames, supportsDateFormat] = await Promise.all([
    hasUserSettingsColumn("defaultSubBudgetNames"),
    hasUserSettingsColumn("dateFormat"),
  ]);

  if (supportsDefaultSubBudgetNames && supportsDateFormat) {
    const [settings] = await prisma.$queryRaw<Array<unknown>>`
      INSERT INTO "UserSettings" (
        "id",
        "userId",
        "defaultCurrency",
        "currencyDecimals",
        "dateFormat",
        "defaultIgvRate",
        "defaultGeneralExpensesRate",
        "defaultUtilityRate",
        "defaultSubBudgetNames",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${userId},
        ${data.defaultCurrency},
        ${data.currencyDecimals},
        ${data.dateFormat},
        ${data.defaultIgvRate},
        ${data.defaultGeneralExpensesRate},
        ${data.defaultUtilityRate},
        ${data.defaultSubBudgetNames},
        NOW(),
        NOW()
      )
      ON CONFLICT ("userId")
      DO UPDATE SET
        "defaultCurrency" = EXCLUDED."defaultCurrency",
        "currencyDecimals" = EXCLUDED."currencyDecimals",
        "dateFormat" = EXCLUDED."dateFormat",
        "defaultIgvRate" = EXCLUDED."defaultIgvRate",
        "defaultGeneralExpensesRate" = EXCLUDED."defaultGeneralExpensesRate",
        "defaultUtilityRate" = EXCLUDED."defaultUtilityRate",
        "defaultSubBudgetNames" = EXCLUDED."defaultSubBudgetNames",
        "updatedAt" = NOW()
      RETURNING
        "defaultCurrency",
        "currencyDecimals",
        "dateFormat",
        "defaultIgvRate",
        "defaultGeneralExpensesRate",
        "defaultUtilityRate",
        "defaultSubBudgetNames"
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
      "defaultIgvRate",
      "defaultGeneralExpensesRate",
      "defaultUtilityRate",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${userId},
      ${data.defaultCurrency},
      ${data.currencyDecimals},
      ${supportsDateFormat ? Prisma.sql`${data.dateFormat},` : Prisma.empty}
      ${data.defaultIgvRate},
      ${data.defaultGeneralExpensesRate},
      ${data.defaultUtilityRate},
      NOW(),
      NOW()
    )
    ON CONFLICT ("userId")
    DO UPDATE SET
      "defaultCurrency" = EXCLUDED."defaultCurrency",
      "currencyDecimals" = EXCLUDED."currencyDecimals",
      ${supportsDateFormat ? Prisma.sql`"dateFormat" = EXCLUDED."dateFormat",` : Prisma.empty}
      "defaultIgvRate" = EXCLUDED."defaultIgvRate",
      "defaultGeneralExpensesRate" = EXCLUDED."defaultGeneralExpensesRate",
      "defaultUtilityRate" = EXCLUDED."defaultUtilityRate",
      "updatedAt" = NOW()
    RETURNING
      "defaultCurrency",
      "currencyDecimals",
      ${supportsDateFormat ? Prisma.sql`"dateFormat",` : Prisma.empty}
      "defaultIgvRate",
      "defaultGeneralExpensesRate",
      "defaultUtilityRate"
  `;

  return parseStoredUserSettingsRow({
    ...settings,
    dateFormat: supportsDateFormat && typeof (settings as Record<string, unknown>).dateFormat !== "undefined"
      ? (settings as Record<string, unknown>).dateFormat
      : data.dateFormat,
    defaultSubBudgetNames: data.defaultSubBudgetNames,
  });
}
