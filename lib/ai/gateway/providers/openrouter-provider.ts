import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, streamText, type ModelMessage } from "ai";
import type { AiProviderRequest, AiProviderResult } from "@/lib/ai/gateway/types";
import type { AiMessage } from "@/lib/ai/types";

export const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-chat-v3-0324:free";

type FetchLike = typeof fetch;

export async function executeOpenRouterProvider({
  fetchImpl = fetch,
  messages,
  apiKey: requestApiKey,
  modelPreference,
}: AiProviderRequest): Promise<AiProviderResult> {
  const apiKey = requestApiKey || process.env.OPENROUTER_API_KEY;
  const requestedModel = modelPreference || process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY no configurado");
  }

  const requestBody = buildOpenRouterDebugRequestBody(requestedModel, messages);
  const { text } = await generateText({
    model: createOpenRouterModel({ apiKey, fetchImpl, model: requestedModel }),
    messages: toModelMessages(messages),
  });
  const answer = text.trim();

  if (!answer) {
    throw new Error("OpenRouter devolvio una respuesta sin texto.");
  }

  return {
    answer,
    provider: "openrouter",
    model: requestedModel,
    requestedModel,
    fallbackUsed: false,
    warnings: [],
    requestBody,
  };
}

export async function* streamOpenRouterChat({
  messages,
  apiKey,
  modelPreference,
  fetchImpl = fetch,
  requestBodyRef,
}: {
  messages: AiMessage[];
  apiKey: string;
  modelPreference?: string;
  fetchImpl?: FetchLike;
  requestBodyRef?: { current?: Record<string, unknown> };
}): AsyncIterable<string> {
  const model = modelPreference || process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  if (requestBodyRef) requestBodyRef.current = buildOpenRouterDebugRequestBody(model, messages);

  const result = streamText({
    model: createOpenRouterModel({ apiKey, fetchImpl, model }),
    messages: toModelMessages(messages),
  });

  let receivedText = "";
  for await (const text of result.textStream) {
    if (text) yield text;
    receivedText += text;
  }

  if (!receivedText.trim()) {
    throw new Error("OpenRouter devolvio una respuesta sin texto.");
  }
}

function createOpenRouterModel({
  apiKey,
  fetchImpl,
  model,
}: {
  apiKey: string;
  fetchImpl: FetchLike;
  model: string;
}) {
  const openrouter = createOpenRouter({
    apiKey,
    fetch: fetchImpl,
    appName: "MYC Presupuestos",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://myc-presupuestos.local",
  });

  return openrouter.chat(model);
}

function toModelMessages(messages: AiMessage[]): ModelMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function buildOpenRouterDebugRequestBody(model: string, messages: AiMessage[]): Record<string, unknown> {
  return {
    model,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  };
}
