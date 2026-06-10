import type { z } from "zod";
import { AiRuntimeError } from "@/lib/ai/errors";
import { resolveAiModel } from "@/lib/ai/models";
import {
  askOllama,
  listInstalledOllamaModels,
  OllamaConnectionError,
  OllamaResponseError,
  OllamaTimeoutError,
  streamOllamaChat,
} from "@/lib/ai/ollama";
import { buildStructuredRepairPrompt } from "@/lib/ai/prompts";
import { recordAiActionMetric } from "@/lib/ai/runtime";
import { parseStructuredAiOutput } from "@/lib/ai/structured-output";
import type { AiAction, AiEndpointResult, AiMessage } from "@/lib/ai/types";
import { assertCanUseAi, recordAiUsage } from "@/lib/ai/usage";

type FetchLike = typeof fetch;

type GenerateAiResponseInput<TStructuredData = unknown> = {
  action: AiAction;
  messages: AiMessage[];
  schema?: z.ZodType<TStructuredData>;
  fetchImpl?: FetchLike;
  userId?: string;
};

type StreamChatAiResponseInput = {
  messages: AiMessage[];
  fetchImpl?: FetchLike;
  userId?: string;
};

export type StreamChatAiResponseEvent =
  | { type: "delta"; text: string }
  | { type: "final"; result: AiEndpointResult };

export async function* streamChatAiResponse({
  messages,
  fetchImpl,
  userId,
}: StreamChatAiResponseInput): AsyncIterable<StreamChatAiResponseEvent> {
  const action: AiAction = "chat";
  const startedAt = Date.now();
  const promptText = messages.map((message) => message.content).join("\n");
  const estimatedTokens = estimateAiTokens(promptText);
  let answer = "";

  try {
    if (userId) {
      await assertCanUseAi({ userId, estimatedTokens });
    }

    const availableModels = await listInstalledOllamaModels(fetchImpl);
    const resolution = resolveAiModel(action, availableModels);

    for await (const text of streamOllamaChat({
      model: resolution.model,
      messages,
      fetchImpl,
    })) {
      answer += text;
      yield { type: "delta", text };
    }

    const latencyMs = Date.now() - startedAt;
    const result: AiEndpointResult = {
      answer: answer.trim(),
      model: resolution.model,
      requestedModel: resolution.requestedModel,
      fallbackUsed: resolution.fallbackUsed,
      warnings: resolution.warnings,
      latencyMs,
      debug: {
        structuredParseStatus: "not_requested",
        rawAnswer: answer,
      },
    };

    recordAiActionMetric(action, { latencyMs, lastError: result.warnings[0] ?? null });

    if (userId) {
      await recordAiUsage({
        userId,
        action,
        provider: "ollama",
        model: resolution.model,
        estimatedTokens,
        actualTokens: estimateAiTokens(`${promptText}\n${result.answer}`),
      });
    }

    yield { type: "final", result };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    recordAiActionMetric(action, {
      latencyMs,
      lastError: error instanceof Error ? error.message : "Error inesperado de IA",
    });

    if (error instanceof OllamaConnectionError) {
      throw new AiRuntimeError("connection", error.message);
    }

    if (error instanceof OllamaResponseError) {
      throw new AiRuntimeError("invalid_response", error.message);
    }

    if (error instanceof OllamaTimeoutError) {
      throw new AiRuntimeError("timeout", error.message);
    }

    if (error instanceof AiRuntimeError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes("Falta instalar")) {
      throw new AiRuntimeError("model_missing", error.message);
    }

    throw error;
  }
}

export async function generateAiResponse<TStructuredData = unknown>({
  action,
  messages,
  schema,
  fetchImpl,
  userId,
}: GenerateAiResponseInput<TStructuredData>): Promise<AiEndpointResult> {
  const startedAt = Date.now();
  const estimatedTokens = estimateAiTokens(messages.map((message) => message.content).join("\n"));

  try {
    if (userId) {
      await assertCanUseAi({ userId, estimatedTokens });
    }

    const availableModels = await listInstalledOllamaModels(fetchImpl);
    const resolution = resolveAiModel(action, availableModels);
    const answer = await askOllama({
      model: resolution.model,
      messages,
      responseFormat: schema ? "json" : undefined,
      fetchImpl,
    });

    const result = schema
      ? await resolveStructuredOutput({
          model: resolution.model,
          messages,
          initialAnswer: answer,
          schema,
          fetchImpl,
        })
      : {
          answer,
          structuredData: undefined,
          warnings: resolution.warnings,
          debug: {
            structuredParseStatus: "not_requested" as const,
            rawAnswer: answer,
          },
        };

    const latencyMs = Date.now() - startedAt;
    recordAiActionMetric(action, { latencyMs, lastError: result.warnings[0] ?? null });

    if (userId) {
      await recordAiUsage({
        userId,
        action,
        provider: "ollama",
        model: resolution.model,
        estimatedTokens,
        actualTokens: estimateAiTokens(`${messages.map((message) => message.content).join("\n")}\n${result.answer}`),
      });
    }

    return {
      answer: result.answer,
      model: resolution.model,
      requestedModel: resolution.requestedModel,
      fallbackUsed: resolution.fallbackUsed,
      warnings: result.warnings,
      latencyMs,
      structuredData: result.structuredData,
      debug: result.debug,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    recordAiActionMetric(action, {
      latencyMs,
      lastError: error instanceof Error ? error.message : "Error inesperado de IA",
    });

    if (error instanceof OllamaConnectionError) {
      throw new AiRuntimeError("connection", error.message);
    }

    if (error instanceof OllamaResponseError) {
      throw new AiRuntimeError("invalid_response", error.message);
    }

    if (error instanceof OllamaTimeoutError) {
      throw new AiRuntimeError("timeout", error.message);
    }

    if (error instanceof AiRuntimeError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes("Falta instalar")) {
      throw new AiRuntimeError("model_missing", error.message);
    }

    throw error;
  }
}

export function estimateAiTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

async function resolveStructuredOutput<TStructuredData>({
  model,
  messages,
  initialAnswer,
  schema,
  fetchImpl,
}: {
  model: string;
  messages: AiMessage[];
  initialAnswer: string;
  schema: z.ZodType<TStructuredData>;
  fetchImpl?: FetchLike;
}) {
  try {
    const parsed = parseStructuredAiOutput({
      answer: initialAnswer,
      schema,
    });

    return {
      answer: parsed.answer,
      structuredData: parsed.data,
      warnings: [] as string[],
      debug: {
        structuredParseStatus: "parsed" as const,
        rawAnswer: initialAnswer,
      },
    };
  } catch {
    const repairedAnswer = await askOllama({
      model,
      messages: [
        ...messages,
        { role: "assistant", content: initialAnswer },
        { role: "user", content: buildStructuredRepairPrompt() },
      ],
      responseFormat: "json",
      fetchImpl,
    });

    try {
      const repaired = parseStructuredAiOutput({
        answer: repairedAnswer,
        schema,
      });

      return {
        answer: repaired.answer,
        structuredData: repaired.data,
        warnings: ["La IA requirio una correccion automatica para devolver JSON estructurado valido."],
        debug: {
          structuredParseStatus: "repaired" as const,
          rawAnswer: initialAnswer,
          repairedRawAnswer: repairedAnswer,
        },
      };
    } catch {
      return {
        answer: repairedAnswer,
        structuredData: undefined,
        warnings: [
          "La IA no devolvio una estructura valida despues del reintento. Se muestra la respuesta textual para revision humana.",
        ],
        debug: {
          structuredParseStatus: "failed" as const,
          rawAnswer: initialAnswer,
          repairedRawAnswer: repairedAnswer,
        },
      };
    }
  }
}
