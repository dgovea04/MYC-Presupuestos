import { prisma } from "@/lib/db/prisma";
import { decryptApiKey, maskApiKey } from "@/lib/ai/encryption";
import type { AiCredentialProvider } from "@/lib/ai/credentials/types";

export type LegacyCredentialMigrationResult = {
  scanned: number;
  migrated: number;
  skipped: number;
  invalid: number;
};

export async function migrateLegacyAiCredentials(): Promise<LegacyCredentialMigrationResult> {
  const result: LegacyCredentialMigrationResult = { scanned: 0, migrated: 0, skipped: 0, invalid: 0 };
  const [systemSettings, userSettings] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { singletonKey: "system" } }),
    prisma.userSettings.findMany({
      select: { userId: true, openaiApiKey: true, geminiApiKey: true, openrouterApiKey: true },
    }),
  ]);

  if (systemSettings) {
    for (const [provider, encryptedSecret] of [
      ["OPENAI", systemSettings.openaiApiKey],
      ["GEMINI", systemSettings.geminiApiKey],
      ["OPENROUTER", systemSettings.openrouterApiKey],
    ] as const) {
      result.scanned += 1;
      await migrateOne({ provider, encryptedSecret, scope: "PLATFORM", result });
    }
  }

  for (const settings of userSettings) {
    for (const [provider, encryptedSecret] of [
      ["OPENAI", settings.openaiApiKey],
      ["GEMINI", settings.geminiApiKey],
      ["OPENROUTER", settings.openrouterApiKey],
    ] as const) {
      result.scanned += 1;
      await migrateOne({ provider, encryptedSecret, scope: "USER", userId: settings.userId, result });
    }
  }

  return result;
}

async function migrateOne({
  provider,
  encryptedSecret,
  scope,
  userId,
  result,
}: {
  provider: AiCredentialProvider;
  encryptedSecret: string | null;
  scope: "PLATFORM" | "USER";
  userId?: string;
  result: LegacyCredentialMigrationResult;
}) {
  if (!encryptedSecret) {
    result.skipped += 1;
    return;
  }

  const apiKey = decryptApiKey(encryptedSecret);
  if (!apiKey) {
    result.invalid += 1;
    return;
  }

  const existing = await prisma.aiCredential.findFirst({
    where: {
      scope,
      provider,
      status: "ACTIVE",
      isFallback: false,
      workspaceId: null,
      userId: scope === "USER" ? userId : null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    result.skipped += 1;
    return;
  }

  await prisma.aiCredential.create({
    data: {
      scope,
      provider,
      userId: scope === "USER" ? userId ?? null : null,
      workspaceId: null,
      encryptedSecret,
      maskedValue: maskApiKey(apiKey),
      createdByUserId: null,
    },
  });
  result.migrated += 1;
}
