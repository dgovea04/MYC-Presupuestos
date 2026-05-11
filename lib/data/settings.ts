import { prisma } from "@/lib/db/prisma";
import { userSettingsSchema, type UserSettingsInput } from "@/lib/validations/settings";
import type { UserSettingsRecord } from "@/types/settings";

export const defaultUserSettings: UserSettingsRecord = {
  currencyDecimals: 2,
};

export async function getUserSettings(userId: string): Promise<UserSettingsRecord> {
  const [settings] = await prisma.$queryRaw<Array<{ currencyDecimals: number }>>`
    SELECT "currencyDecimals"
    FROM "UserSettings"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;

  return {
    ...defaultUserSettings,
    ...settings,
  };
}

export async function updateUserSettings(userId: string, input: UserSettingsInput): Promise<UserSettingsRecord> {
  const data = userSettingsSchema.parse(input);

  const [settings] = await prisma.$queryRaw<Array<{ currencyDecimals: number }>>`
    INSERT INTO "UserSettings" ("id", "userId", "currencyDecimals", "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${userId}, ${data.currencyDecimals}, NOW(), NOW())
    ON CONFLICT ("userId")
    DO UPDATE SET
      "currencyDecimals" = EXCLUDED."currencyDecimals",
      "updatedAt" = NOW()
    RETURNING "currencyDecimals"
  `;

  return settings;
}
