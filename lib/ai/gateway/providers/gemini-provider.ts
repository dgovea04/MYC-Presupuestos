import type { AiProviderRequest, AiProviderResult } from "@/lib/ai/gateway/types";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export async function executeGeminiProvider({
  fetchImpl = fetch,
  messages,
}: AiProviderRequest): Promise<AiProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const requestedModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurado");
  }

  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(requestedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n"),
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini respondio con estado ${response.status}.`);
  }

  const payload: unknown = await response.json();

  return {
    answer: parseGeminiResponseText(payload),
    provider: "gemini",
    model: requestedModel,
    requestedModel,
    fallbackUsed: false,
    warnings: [],
  };
}

export function parseGeminiResponseText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) {
    throw new Error("Gemini devolvio una respuesta sin candidatos.");
  }

  const text = payload.candidates
    .flatMap((candidate) => {
      if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
        return [];
      }

      return candidate.content.parts;
    })
    .map((part) => readStringProperty(part, "text"))
    .find((partText): partText is string => typeof partText === "string" && partText.trim().length > 0);

  if (!text) {
    throw new Error("Gemini devolvio una respuesta sin texto.");
  }

  return text.trim();
}

function readStringProperty(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  const property = value[key];
  return typeof property === "string" && property.trim().length > 0 ? property : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
