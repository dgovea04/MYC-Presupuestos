import { prisma } from "@/lib/db/prisma";
import { encryptApiKey, decryptApiKey, maskApiKey } from "@/lib/ai/encryption";

export type SystemSettingsInput = {
  openaiApiKey?: string | null;
  geminiApiKey?: string | null;
  openaiModel?: string | null;
  geminiModel?: string | null;
};

export type SystemSettings = {
  openaiApiKey: string;
  geminiApiKey: string;
  openaiApiKeyMasked: string;
  geminiApiKeyMasked: string;
  openaiModel: string;
  geminiModel: string;
  openaiConfigured: boolean;
  geminiConfigured: boolean;
};

const SINGLETON_KEY = "system";

export async function getSystemSettings(): Promise<SystemSettings> {
  const settings = await prisma.systemSettings.findUnique({
    where: { singletonKey: SINGLETON_KEY },
  });

  if (!settings) {
    return {
      openaiApiKey: "",
      geminiApiKey: "",
      openaiApiKeyMasked: "",
      geminiApiKeyMasked: "",
      openaiModel: "",
      geminiModel: "",
      openaiConfigured: false,
      geminiConfigured: false,
    };
  }

  const encryptedOpenai = settings.openaiApiKey ?? "";
  const encryptedGemini = settings.geminiApiKey ?? "";
  const decryptedOpenai = encryptedOpenai ? decryptApiKey(encryptedOpenai) : "";
  const decryptedGemini = encryptedGemini ? decryptApiKey(encryptedGemini) : "";

  return {
    openaiApiKey: decryptedOpenai,
    geminiApiKey: decryptedGemini,
    openaiApiKeyMasked: maskApiKey(decryptedOpenai),
    geminiApiKeyMasked: maskApiKey(decryptedGemini),
    openaiModel: settings.openaiModel ?? "",
    geminiModel: settings.geminiModel ?? "",
    openaiConfigured: decryptedOpenai.length > 0,
    geminiConfigured: decryptedGemini.length > 0,
  };
}

export async function updateSystemSettings(input: SystemSettingsInput): Promise<SystemSettings> {
  const encryptedOpenaiKey =
    input.openaiApiKey && input.openaiApiKey.trim().length > 0
      ? encryptApiKey(input.openaiApiKey.trim())
      : input.openaiApiKey === ""
        ? ""
        : undefined;
  const encryptedGeminiKey =
    input.geminiApiKey && input.geminiApiKey.trim().length > 0
      ? encryptApiKey(input.geminiApiKey.trim())
      : input.geminiApiKey === ""
        ? ""
        : undefined;

  const settings = await prisma.systemSettings.upsert({
    where: { singletonKey: SINGLETON_KEY },
    create: {
      singletonKey: SINGLETON_KEY,
      openaiApiKey: encryptedOpenaiKey ?? null,
      geminiApiKey: encryptedGeminiKey ?? null,
      openaiModel: input.openaiModel?.trim() || null,
      geminiModel: input.geminiModel?.trim() || null,
    },
    update: {
      ...(encryptedOpenaiKey !== undefined ? { openaiApiKey: encryptedOpenaiKey || null } : {}),
      ...(encryptedGeminiKey !== undefined ? { geminiApiKey: encryptedGeminiKey || null } : {}),
      // != null covers both null and undefined — skip field entirely when not explicitly provided
      ...(input.openaiModel != null ? { openaiModel: input.openaiModel.trim() || null } : {}),
      ...(input.geminiModel != null ? { geminiModel: input.geminiModel.trim() || null } : {}),
    },
  });

  const storedEncryptedOpenai = settings.openaiApiKey ?? "";
  const storedEncryptedGemini = settings.geminiApiKey ?? "";
  const storedDecryptedOpenai = storedEncryptedOpenai ? decryptApiKey(storedEncryptedOpenai) : "";
  const storedDecryptedGemini = storedEncryptedGemini ? decryptApiKey(storedEncryptedGemini) : "";

  return {
    openaiApiKey: storedDecryptedOpenai,
    geminiApiKey: storedDecryptedGemini,
    openaiApiKeyMasked: maskApiKey(storedDecryptedOpenai),
    geminiApiKeyMasked: maskApiKey(storedDecryptedGemini),
    openaiModel: settings.openaiModel ?? "",
    geminiModel: settings.geminiModel ?? "",
    openaiConfigured: storedDecryptedOpenai.length > 0,
    geminiConfigured: storedDecryptedGemini.length > 0,
  };
}

export async function getDecryptedSystemOpenaiApiKey(): Promise<string> {
  const settings = await getSystemSettings();
  return settings.openaiApiKey;
}

export async function getDecryptedSystemGeminiApiKey(): Promise<string> {
  const settings = await getSystemSettings();
  return settings.geminiApiKey;
}
