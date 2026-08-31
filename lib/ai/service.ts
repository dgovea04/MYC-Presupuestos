import crypto from "node:crypto";
import type { z } from "zod";
import { AiRuntimeError } from "@/lib/ai/errors";
import { isLocalRuntimeEnabled } from "@/lib/runtime/local-capabilities";
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
import { reserveAiUsage, recordScopedAiUsage, releaseAiUsage, recordPlatformAiUsage } from "@/lib/ai/usage-scope";
import { OPENAI_RESPONSES_URL, DEFAULT_OPENAI_MODEL } from "@/lib/ai/gateway/providers/openai-provider";
import { buildGeminiRequestBody, DEFAULT_GEMINI_MODEL, isGemmaModel, resolveEffectiveGeminiModel, simplifyMessagesForGemma } from "@/lib/ai/gateway/providers/gemini-provider";
import { DEFAULT_OPENROUTER_MODEL, streamOpenRouterChat } from "@/lib/ai/gateway/providers/openrouter-provider";
import { DEFAULT_AGENT_MODEL, streamAgentChat } from "@/lib/ai/gateway/providers/agent-provider";

type FetchLike = typeof fetch;

const STREAM_TIMEOUT_MS = 180_000;

type GenerateAiResponseInput<TStructuredData = unknown> = {
  action: AiAction;
  messages: AiMessage[];
  schema?: z.ZodType<TStructuredData>;
  fetchImpl?: FetchLike;
  userId?: string;
};

type RequestBodyRef = { current?: Record<string, unknown> };

type StreamChatAiResponseInput = {
  messages: AiMessage[];
  fetchImpl?: FetchLike;
  userId?: string;
  projectId?: string;
  workspaceId?: string;
  requestId?: string;
  modelPreference?: string;
  credentialSource?: "PLATFORM" | "WORKSPACE" | "USER" | "ENVIRONMENT";
  credentialId?: string | null;
  billingScope?: "PLATFORM" | "WORKSPACE" | "USER";
  provider?: "ollama" | "openai" | "gemini" | "openrouter" | "agent" | "chatgpt_bridge";
  apiKey?: string;
  tokenLimit?: number | null;
  budgetLimitMinor?: number | null;
  hardLimit?: boolean;
  alertThresholds?: number[];
  allowAgentWrites?: boolean;
};

export type StreamChatAiResponseEvent =
  | { type: "delta"; text: string }
  | { type: "final"; result: AiEndpointResult };

export async function* streamOpenAIChat({
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
  requestBodyRef?: RequestBodyRef;
}): AsyncIterable<string> {
  const model = modelPreference || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

  const requestBody: Record<string, unknown> = {
    model,
    input: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    stream: true,
  };
  if (requestBodyRef) requestBodyRef.current = requestBody;

  let response: Response;
  const abortController = new AbortController();
  let timeout = setTimeout(() => abortController.abort(), STREAM_TIMEOUT_MS);
  const resetTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => abortController.abort(), STREAM_TIMEOUT_MS);
  };

  try {
    response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: abortController.signal,
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    clearTimeout(timeout);
    if (abortController.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new AiRuntimeError("timeout", `OpenAI tardo mas de ${Math.round(STREAM_TIMEOUT_MS / 1000)} segundos en responder.`);
    }
    throw new AiRuntimeError("connection", "No se pudo conectar con OpenAI. Verifica tu API key y conexion a internet.");
  }

  if (!response.ok) {
    clearTimeout(timeout);
    const errorText = await readResponseTextSafely(response);
    throw new AiRuntimeError("invalid_response", `OpenAI respondio con estado ${response.status}. ${errorText}`.trim());
  }

  if (!response.body) {
    clearTimeout(timeout);
    throw new AiRuntimeError("invalid_response", "OpenAI no devolvio un stream de respuesta.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      resetTimeout();
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const text = parseOpenAIStreamLine(line);
        if (text) yield text;
      }
    }

    buffer += decoder.decode();
    const finalText = parseOpenAIStreamLine(buffer);
    if (finalText) yield finalText;
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
}

export async function* streamGeminiChat({
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
  requestBodyRef?: RequestBodyRef;
}): AsyncIterable<string> {
  const model = modelPreference || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const isGemma = isGemmaModel(model);
  const effectiveMessages = isGemma ? simplifyMessagesForGemma(messages) : messages;
  // Gemma uses simplified messages with flat prompt (Ollama-style SYSTEM: prefix in contents)
  const requestBody = buildGeminiRequestBody(effectiveMessages, { useFlatPrompt: isGemma });
  if (requestBodyRef) requestBodyRef.current = requestBody;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  let response: Response;
  const abortController = new AbortController();
  let timeout = setTimeout(() => abortController.abort(), STREAM_TIMEOUT_MS);
  const resetTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => abortController.abort(), STREAM_TIMEOUT_MS);
  };

  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    clearTimeout(timeout);
    if (abortController.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new AiRuntimeError("timeout", `Gemini tardo mas de ${Math.round(STREAM_TIMEOUT_MS / 1000)} segundos en responder.`);
    }
    throw new AiRuntimeError("connection", "No se pudo conectar con Gemini. Verifica tu API key y conexion a internet.");
  }

  if (!response.ok) {
    clearTimeout(timeout);
    const errorText = await readResponseTextSafely(response);
    throw new AiRuntimeError("invalid_response", `Gemini respondio con estado ${response.status}. ${errorText}`.trim());
  }

  if (!response.body) {
    clearTimeout(timeout);
    throw new AiRuntimeError("invalid_response", "Gemini no devolvio un stream de respuesta.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      resetTimeout();
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const text = parseGeminiStreamLine(line);
        if (text) yield text;
      }
    }

    buffer += decoder.decode();
    const finalText = parseGeminiStreamLine(buffer);
    if (finalText) yield finalText;
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
}

export async function* streamChatAiResponse({
  messages,
  fetchImpl,
  userId,
  projectId,
  workspaceId,
  provider,
  apiKey,
  modelPreference,
  credentialSource,
  credentialId,
  billingScope,
  requestId: requestedRequestId,
  tokenLimit: inputTokenLimit,
  budgetLimitMinor: inputBudgetLimitMinor,
  hardLimit: inputHardLimit = true,
  alertThresholds: inputAlertThresholds = [],
  allowAgentWrites: inputAllowAgentWrites = true,
}: StreamChatAiResponseInput): AsyncIterable<StreamChatAiResponseEvent> {
  const action: AiAction = "chat";
  const startedAt = Date.now();
  const promptText = messages.map((message) => message.content).join("\n");
  const estimatedTokens = estimateAiTokens(promptText);
  let answer = "";
  let resolvedModel = "";
  let requestedModel = "";
  let fallbackUsed = false;
  const warnings: string[] = [];
  const requestBodyRef: RequestBodyRef = {};
  const requestId = requestedRequestId ?? crypto.randomUUID();
  const effectiveProvider = resolveStreamingProvider(provider);
  const resolvedApiKey = apiKey;
  const resolvedModelPreference = modelPreference;
  const scopedAccounting = Boolean(userId && workspaceId && billingScope && billingScope !== "PLATFORM");
  // Uso facturado a la plataforma (key del sistema): contabilidad independiente.
  // No reserva ni descuenta del cupo del usuario, y no queda limitado por él.
  const platformAccounting = Boolean(userId && billingScope === "PLATFORM");
  let scopedReservation: { estimatedTokens: number; estimatedCostMinor?: number; periodStart: Date } | null = null;

  try {
    if (userId && scopedAccounting) {
      scopedReservation = await reserveAiUsage({
        userId,
        workspaceId,
        billingScope: billingScope ?? "WORKSPACE",
        estimatedTokens,
        allowance: inputTokenLimit,
        budgetMinor: inputBudgetLimitMinor,
        provider: provider ?? "ollama",
        model: resolvedModelPreference ?? "auto",
        action,
        credentialSource,
        credentialId,
        requestId,
        hardLimit: inputHardLimit,
        alertThresholds: inputAlertThresholds,
      });
    } else if (userId && !platformAccounting) {
      await assertCanUseAi({ userId, estimatedTokens });
    }

    // Route streaming to the appropriate provider
    if (effectiveProvider === "openai") {
      if (!resolvedApiKey) {
        throw new AiRuntimeError("connection", "OPENAI_API_KEY no configurado. Agrega tu API key en Configuracion.");
      }
      const model = resolvedModelPreference || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
      resolvedModel = model;
      requestedModel = model;

      for await (const text of streamOpenAIChat({ messages, apiKey: resolvedApiKey, modelPreference: resolvedModelPreference, fetchImpl, requestBodyRef })) {
        answer += text;
        yield { type: "delta", text };
      }
    } else if (effectiveProvider === "gemini") {
      if (!resolvedApiKey) {
        throw new AiRuntimeError("connection", "GEMINI_API_KEY no configurado. Agrega tu API key en Configuracion.");
      }
      const rawModel = resolvedModelPreference || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
      // Streaming is only used for chat; Gemma models fall back to default for non-autocomplete tasks
      const resolved = resolveEffectiveGeminiModel(rawModel, "chat");
      requestedModel = rawModel;
      resolvedModel = resolved.model;
      if (resolved.warning) warnings.push(resolved.warning);

      for await (const text of streamGeminiChat({ messages, apiKey: resolvedApiKey, modelPreference: resolved.model, fetchImpl, requestBodyRef })) {
        answer += text;
        yield { type: "delta", text };
      }
    } else if (effectiveProvider === "openrouter") {
      const openRouterApiKey = resolvedApiKey || process.env.OPENROUTER_API_KEY;
      if (!openRouterApiKey) {
        throw new AiRuntimeError("connection", "OPENROUTER_API_KEY no configurado. Agrega tu API key en .env.");
      }
      const model = resolvedModelPreference || process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
      resolvedModel = model;
      requestedModel = model;

      for await (const text of streamOpenRouterChat({ messages, apiKey: openRouterApiKey, modelPreference: model, fetchImpl, requestBodyRef })) {
        answer += text;
        yield { type: "delta", text };
      }
    } else if (effectiveProvider === "agent") {
      if (!resolvedApiKey) {
        throw new AiRuntimeError(
          "connection",
          "No hay API key configurada para el agente. " +
          "Ve a Configuración > IA > Proveedores Cloud IA y agrega tu API key de OpenRouter.",
        );
      }
      const model = resolvedModelPreference || DEFAULT_AGENT_MODEL;
      resolvedModel = model;
      requestedModel = model;

      // Agregar system prompt como mensaje si no viene en messages
      const hasSystem = messages.some((m) => m.role === "system");
      const agentMessages = hasSystem
        ? messages
        : [{ role: "system" as const, content: "Eres Khipu, un agente técnico especializado en presupuestos de construcción. Usa las herramientas disponibles para analizar, calcular y generar información precisa." }, ...messages];

      for await (const event of streamAgentChat({
        task: "chat",
        messages: agentMessages,
        apiKey: resolvedApiKey,
        modelPreference: model,
        userId: userId ?? "anonymous",
        projectId,
        workspaceId,
        allowAgentWrites: inputAllowAgentWrites,
        requestId,
      })) {
        if (event.type === "delta") {
          yield { type: "delta", text: event.text };
        } else if (event.type === "final") {
          // Final event — merge with the accumulated answer
          answer = event.result.answer;
          if (platformAccounting) {
            await recordPlatformAiUsage({
              userId: userId ?? "anonymous",
              workspaceId: workspaceId ?? null,
              requestId,
              provider: provider ?? "agent",
              model: resolvedModel,
              action,
              estimatedTokens,
              actualTokens: estimateAiTokens(`${promptText}\n${answer}`),
            });
          }
          yield { type: "final", result: event.result };
          return;
        }
      }
    } else {
      // Ollama is intentionally restricted to the local desktop/dev runtime.
      if (!isLocalRuntimeEnabled()) {
        throw new AiRuntimeError("local_only", "Ollama solo esta disponible en la app local.");
      }

      const availableModels = await listInstalledOllamaModels(fetchImpl);
      const resolution = resolveAiModel(action, availableModels);
      resolvedModel = resolution.model;
      requestedModel = resolution.requestedModel;
      fallbackUsed = resolution.fallbackUsed;
      warnings.push(...resolution.warnings);

      for await (const text of streamOllamaChat({
        model: resolution.model,
        messages,
        fetchImpl,
      })) {
        answer += text;
        yield { type: "delta", text };
      }
    }

    const latencyMs = Date.now() - startedAt;

    // Build enriched debug similar to generateAiResponse
    const enrichedDebug: AiEndpointResult["debug"] = {
      structuredParseStatus: "not_requested",
      rawAnswer: answer,
      context: messages.find((m) => m.role === "system")?.content ?? undefined,
      messages,
      ai: {
        answer: answer.trim(),
        rawAnswer: answer,
        structuredParseStatus: "not_requested",
      },
      fallback: {
        used: fallbackUsed,
        reason: warnings.length > 0 ? warnings.join("; ") : undefined,
      },
      validationWarnings: warnings,
      requestBody: requestBodyRef.current,
    };

      const result: AiEndpointResult = {
      answer: answer.trim(),
      model: resolvedModel,
      requestedModel,
      fallbackUsed,
      warnings,
      latencyMs,
      workspaceId,
      credentialSource,
      credentialId,
      billingScope,
      requestId,
      debug: enrichedDebug,
    };

    recordAiActionMetric(action, { latencyMs, lastError: result.warnings[0] ?? null });

    if (userId && scopedAccounting && scopedReservation) {
      await recordScopedAiUsage({
        userId,
        workspaceId,
        billingScope: billingScope ?? "WORKSPACE",
        credentialSource,
        credentialId,
        requestId,
        provider: provider ?? "ollama",
        model: resolvedModel,
        action,
        estimatedTokens: scopedReservation.estimatedTokens,
        actualTokens: estimateAiTokens(`${promptText}\n${result.answer}`),
        reservedCostMinor: scopedReservation.estimatedCostMinor,
        periodStart: scopedReservation.periodStart,
      });
    } else if (userId && platformAccounting) {
      await recordPlatformAiUsage({
        userId,
        workspaceId: workspaceId ?? null,
        requestId,
        provider: provider ?? "ollama",
        model: resolvedModel,
        action,
        estimatedTokens,
        actualTokens: estimateAiTokens(`${promptText}\n${result.answer}`),
      });
    } else if (userId) {
      await recordAiUsage({
        userId,
        action,
        provider: provider ?? "ollama",
        model: resolvedModel,
        estimatedTokens,
        actualTokens: estimateAiTokens(`${promptText}\n${result.answer}`),
      });
    }

    yield { type: "final", result };
  } catch (error) {
    if (userId && scopedAccounting && scopedReservation) {
      await releaseAiUsage({
        userId,
        workspaceId,
        billingScope: billingScope ?? "WORKSPACE",
        estimatedTokens: scopedReservation.estimatedTokens,
        provider: provider ?? "ollama",
        model: resolvedModel || resolvedModelPreference || "auto",
        action,
        credentialSource,
        credentialId,
        requestId,
        estimatedCostMinor: scopedReservation.estimatedCostMinor,
        periodStart: scopedReservation.periodStart,
      }).catch(() => undefined);
    }

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

function resolveStreamingProvider(provider?: string): "ollama" | "openai" | "gemini" | "openrouter" | "agent" | "chatgpt_bridge" {
  if (provider === "openai") return "openai";
  if (provider === "gemini") return "gemini";
  if (provider === "openrouter") return "openrouter";
  if (provider === "agent") return "agent";
  if (provider === "chatgpt_bridge") return "chatgpt_bridge";
  return "ollama";
}

function parseOpenAIStreamLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data: ")) return null;

  const dataText = trimmed.slice("data: ".length);
  if (dataText === "[DONE]") return null;

  try {
    const parsed = JSON.parse(dataText);
    if (!isRecord(parsed)) return null;

    // Handle response.output_text.delta events
    if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") {
      return parsed.delta;
    }

    return null;
  } catch {
    return null;
  }
}

function parseGeminiStreamLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data: ")) return null;

  const dataText = trimmed.slice("data: ".length);
  if (!dataText) return null;

  try {
    const parsed = JSON.parse(dataText);
    if (!isRecord(parsed) || !Array.isArray(parsed.candidates)) return null;

    let combined = "";
    for (const candidate of parsed.candidates) {
      if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) continue;
      for (const part of candidate.content.parts) {
        if (isRecord(part) && typeof part.text === "string") {
          combined += part.text;
        }
      }
    }

    return combined.length > 0 ? combined : null;
  } catch {
    return null;
  }
}

async function readResponseTextSafely(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

    const repairedRawAnswer =
      result.debug && "repairedRawAnswer" in result.debug
        ? (result.debug as { repairedRawAnswer?: string }).repairedRawAnswer
        : undefined;

    const enrichedDebug = result.debug
      ? {
          ...result.debug,
          context: messages.find((m) => m.role === "system")?.content ?? undefined,
          messages,
          ai: {
            answer: result.answer,
            rawAnswer: result.debug.rawAnswer,
            repairedRawAnswer,
            structuredParseStatus: result.debug.structuredParseStatus,
          },
          fallback: {
            used: resolution.fallbackUsed,
            reason: resolution.warnings.length > 0 ? resolution.warnings.join("; ") : undefined,
          },
          validationWarnings: result.warnings,
        }
      : undefined;

    return {
      answer: result.answer,
      model: resolution.model,
      requestedModel: resolution.requestedModel,
      fallbackUsed: resolution.fallbackUsed,
      warnings: result.warnings,
      latencyMs,
      structuredData: result.structuredData,
      debug: enrichedDebug,
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
