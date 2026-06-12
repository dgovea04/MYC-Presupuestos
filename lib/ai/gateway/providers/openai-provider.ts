import type { AiProviderRequest, AiProviderResult } from "@/lib/ai/gateway/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

export async function executeOpenAIProvider({
  fetchImpl = fetch,
  messages,
}: AiProviderRequest): Promise<AiProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const requestedModel = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurado");
  }

  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: requestedModel,
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI respondio con estado ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const answer = parseOpenAIResponseText(payload);
  const model = readStringProperty(payload, "model") ?? requestedModel;

  return {
    answer,
    provider: "openai",
    model,
    requestedModel,
    fallbackUsed: false,
    warnings: [],
  };
}

export function parseOpenAIResponseText(payload: unknown): string {
  if (isRecord(payload) && typeof payload.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  if (isRecord(payload) && Array.isArray(payload.output)) {
    const nestedText = payload.output
      .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
      .map((contentItem) => readStringProperty(contentItem, "text"))
      .find((text): text is string => typeof text === "string" && text.trim().length > 0);

    if (nestedText) {
      return nestedText.trim();
    }
  }

  throw new Error("OpenAI devolvio una respuesta sin texto.");
}

function readStringProperty(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  const property = value[key];
  return typeof property === "string" && property.trim().length > 0 ? property : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
