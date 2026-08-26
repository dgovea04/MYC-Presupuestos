import type { AiCredentialProvider } from "@/lib/ai/credentials/types";

export type ProviderValidationResult = {
  valid: boolean;
  provider: AiCredentialProvider;
  status: number | null;
  errorCode: string | null;
};

export async function validateAiProviderCredential(input: {
  provider: AiCredentialProvider;
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<ProviderValidationResult> {
  const apiKey = input.apiKey.trim();
  const timeoutMs = Math.max(1000, Math.min(input.timeoutMs ?? 8000, 20_000));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await (input.fetchImpl ?? fetch)(providerUrl(input.provider), {
      headers: providerHeaders(input.provider, apiKey),
      signal: controller.signal,
    });
    return {
      valid: response.ok,
      provider: input.provider,
      status: response.status,
      errorCode: response.ok ? null : normalizeProviderStatus(response.status),
    };
  } catch (error) {
    return {
      valid: false,
      provider: input.provider,
      status: null,
      errorCode: error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : "CONNECTION_ERROR",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function providerUrl(provider: AiCredentialProvider) {
  if (provider === "OPENAI") return "https://api.openai.com/v1/models";
  if (provider === "GEMINI") return "https://generativelanguage.googleapis.com/v1beta/models";
  return "https://openrouter.ai/api/v1/models";
}

function providerHeaders(provider: AiCredentialProvider, apiKey: string): HeadersInit {
  if (provider === "GEMINI") return { "X-goog-api-key": apiKey };
  return { Authorization: `Bearer ${apiKey}` };
}

function normalizeProviderStatus(status: number) {
  if (status === 401 || status === 403) return "INVALID_CREDENTIAL";
  if (status === 429) return "PROVIDER_RATE_LIMITED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "PROVIDER_REJECTED";
}
