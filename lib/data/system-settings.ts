import { prisma } from "@/lib/db/prisma";
import { encryptApiKey, decryptApiKey, maskApiKey } from "@/lib/ai/encryption";

export type SystemSettingsInput = {
  openaiApiKey?: string | null;
  geminiApiKey?: string | null;
  openrouterApiKey?: string | null;
  openaiModel?: string | null;
  geminiModel?: string | null;
  openrouterModel?: string | null;
  agentModel?: string | null;
};

export type SystemSettings = {
  openaiApiKey: string;
  geminiApiKey: string;
  openrouterApiKey: string;
  openaiApiKeyMasked: string;
  geminiApiKeyMasked: string;
  openrouterApiKeyMasked: string;
  openaiModel: string;
  geminiModel: string;
  openrouterModel: string;
  agentModel: string;
  openaiConfigured: boolean;
  geminiConfigured: boolean;
  openrouterConfigured: boolean;
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
      openrouterApiKey: "",
      openaiApiKeyMasked: "",
      geminiApiKeyMasked: "",
      openrouterApiKeyMasked: "",
      openaiModel: "",
      geminiModel: "",
      openrouterModel: "",
      agentModel: "",
      openaiConfigured: false,
      geminiConfigured: false,
      openrouterConfigured: false,
    };
  }

  const encryptedOpenai = settings.openaiApiKey ?? "";
  const encryptedGemini = settings.geminiApiKey ?? "";
  const encryptedOpenrouter = settings.openrouterApiKey ?? "";
  const decryptedOpenai = encryptedOpenai ? decryptApiKey(encryptedOpenai) : "";
  const decryptedGemini = encryptedGemini ? decryptApiKey(encryptedGemini) : "";
  const decryptedOpenrouter = encryptedOpenrouter ? decryptApiKey(encryptedOpenrouter) : "";

  return {
    openaiApiKey: decryptedOpenai,
    geminiApiKey: decryptedGemini,
    openrouterApiKey: decryptedOpenrouter,
    openaiApiKeyMasked: maskApiKey(decryptedOpenai),
    geminiApiKeyMasked: maskApiKey(decryptedGemini),
    openrouterApiKeyMasked: maskApiKey(decryptedOpenrouter),
    openaiModel: settings.openaiModel ?? "",
    geminiModel: settings.geminiModel ?? "",
    openrouterModel: settings.openrouterModel ?? "",
    agentModel: settings.agentModel ?? "",
    openaiConfigured: decryptedOpenai.length > 0,
    geminiConfigured: decryptedGemini.length > 0,
    openrouterConfigured: decryptedOpenrouter.length > 0,
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
  const encryptedOpenrouterKey =
    input.openrouterApiKey && input.openrouterApiKey.trim().length > 0
      ? encryptApiKey(input.openrouterApiKey.trim())
      : input.openrouterApiKey === ""
        ? ""
        : undefined;

  const settings = await prisma.systemSettings.upsert({
    where: { singletonKey: SINGLETON_KEY },
    create: {
      singletonKey: SINGLETON_KEY,
      openaiApiKey: encryptedOpenaiKey ?? null,
      geminiApiKey: encryptedGeminiKey ?? null,
      openrouterApiKey: encryptedOpenrouterKey ?? null,
      openaiModel: input.openaiModel?.trim() || null,
      geminiModel: input.geminiModel?.trim() || null,
      openrouterModel: input.openrouterModel?.trim() || null,
      agentModel: input.agentModel?.trim() || null,
    },
    update: {
      ...(encryptedOpenaiKey !== undefined ? { openaiApiKey: encryptedOpenaiKey || null } : {}),
      ...(encryptedGeminiKey !== undefined ? { geminiApiKey: encryptedGeminiKey || null } : {}),
      ...(encryptedOpenrouterKey !== undefined ? { openrouterApiKey: encryptedOpenrouterKey || null } : {}),
      // != null covers both null and undefined — skip field entirely when not explicitly provided
      ...(input.openaiModel != null ? { openaiModel: input.openaiModel.trim() || null } : {}),
      ...(input.geminiModel != null ? { geminiModel: input.geminiModel.trim() || null } : {}),
      ...(input.openrouterModel != null ? { openrouterModel: input.openrouterModel.trim() || null } : {}),
      ...(input.agentModel != null ? { agentModel: input.agentModel.trim() || null } : {}),
    },
  });

  const storedEncryptedOpenai = settings.openaiApiKey ?? "";
  const storedEncryptedGemini = settings.geminiApiKey ?? "";
  const storedEncryptedOpenrouter = settings.openrouterApiKey ?? "";
  const storedDecryptedOpenai = storedEncryptedOpenai ? decryptApiKey(storedEncryptedOpenai) : "";
  const storedDecryptedGemini = storedEncryptedGemini ? decryptApiKey(storedEncryptedGemini) : "";
  const storedDecryptedOpenrouter = storedEncryptedOpenrouter ? decryptApiKey(storedEncryptedOpenrouter) : "";

  return {
    openaiApiKey: storedDecryptedOpenai,
    geminiApiKey: storedDecryptedGemini,
    openrouterApiKey: storedDecryptedOpenrouter,
    openaiApiKeyMasked: maskApiKey(storedDecryptedOpenai),
    geminiApiKeyMasked: maskApiKey(storedDecryptedGemini),
    openrouterApiKeyMasked: maskApiKey(storedDecryptedOpenrouter),
    openaiModel: settings.openaiModel ?? "",
    geminiModel: settings.geminiModel ?? "",
    openrouterModel: settings.openrouterModel ?? "",
    agentModel: settings.agentModel ?? "",
    openaiConfigured: storedDecryptedOpenai.length > 0,
    geminiConfigured: storedDecryptedGemini.length > 0,
    openrouterConfigured: storedDecryptedOpenrouter.length > 0,
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

export async function getDecryptedSystemOpenrouterApiKey(): Promise<string> {
  const settings = await getSystemSettings();
  return settings.openrouterApiKey;
}
