import { getAiProviderSettings, getDecryptedGeminiApiKey, getDecryptedOpenaiApiKey, getDecryptedOpenrouterApiKey } from "@/lib/data/settings";
import { getSystemSettings } from "@/lib/data/system-settings";
import type { PdfImportProvider } from "@/types/settings";

export type PdfImportAiConfiguration = {
  provider: PdfImportProvider;
  apiKey: string;
  model?: string;
};

export async function getPdfImportAiConfiguration(userId: string): Promise<PdfImportAiConfiguration> {
  const settings = await getAiProviderSettings(userId);
  const provider = settings.pdfImportProvider;
  const userApiKey = await getUserProviderApiKey(userId, provider);

  if (userApiKey) {
    return {
      provider,
      apiKey: userApiKey,
      model: getUserProviderModel(settings, provider),
    };
  }

  const systemSettings = await getSystemSettings();
  return {
    provider,
    apiKey: getSystemProviderApiKey(systemSettings, provider),
    model: getSystemProviderModel(systemSettings, provider) || getUserProviderModel(settings, provider),
  };
}

async function getUserProviderApiKey(userId: string, provider: PdfImportProvider) {
  if (provider === "openai") return getDecryptedOpenaiApiKey(userId);
  if (provider === "gemini") return getDecryptedGeminiApiKey(userId);
  return getDecryptedOpenrouterApiKey(userId);
}

function getUserProviderModel(
  settings: Awaited<ReturnType<typeof getAiProviderSettings>>,
  provider: PdfImportProvider,
) {
  if (provider === "openai") return settings.openaiModel || undefined;
  if (provider === "gemini") return settings.geminiModel || undefined;
  return settings.openrouterModel || undefined;
}

function getSystemProviderApiKey(
  settings: Awaited<ReturnType<typeof getSystemSettings>>,
  provider: PdfImportProvider,
) {
  if (provider === "openai") return settings.openaiApiKey;
  if (provider === "gemini") return settings.geminiApiKey;
  return settings.openrouterApiKey;
}

function getSystemProviderModel(
  settings: Awaited<ReturnType<typeof getSystemSettings>>,
  provider: PdfImportProvider,
) {
  if (provider === "openai") return settings.openaiModel || undefined;
  if (provider === "gemini") return settings.geminiModel || undefined;
  return settings.openrouterModel || undefined;
}
