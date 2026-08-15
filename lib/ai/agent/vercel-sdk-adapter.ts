import { generateText, stepCountIs, type ModelMessage, type LanguageModel } from "ai";
import type { z } from "zod";
import type {
  AgentSdkToolDefinition,
  AgentToolCall,
} from "./types";
import { AGENT_LIMITS } from "./types";
import type { AgentVercelSdkAdapter, AgentVercelSdkLoopInput, AgentVercelSdkLoopOutput, AgentLoopMessage } from "./contracts";

/**
 * Resultado tipado de una llamada a generateText con tools.
 */
type GenerateTextToolResult = {
  text: string;
  finishReason: string;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  toolCalls: Array<{
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
  }>;
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
  }>;
  steps: Array<{
    text: string;
    finishReason: string;
    toolCalls: Array<{
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }>;
    toolResults: Array<{
      toolCallId: string;
      toolName: string;
      input: Record<string, unknown>;
      output: unknown;
    }>;
  }>;
};

/**
 * Vercel AI SDK Adapter.
 *
 * Responsabilidades:
 * - Formatear mensajes y tools para el SDK
 * - Ejecutar el loop modelo mediante generateText
 * - Extraer tool calls, usage y finish reason
 *
 * El modelo ya viene resuelto por el gateway (provider routing, API keys, fallback).
 * El adapter solo ejecuta el loop. Esto mantiene la separación:
 *   gateway/* → resuelve proveedor, modelo, usage, fallback
 *   adapter   → formatea mensajes, tools, ejecuta generateText, extrae resultados
 */
export class VercelSdkAdapter implements AgentVercelSdkAdapter {
  async runLoop(input: AgentVercelSdkLoopInput): Promise<AgentVercelSdkLoopOutput> {
    const {
      system,
      messages,
      tools,
      stopWhen = "final_text",
      provider = "unknown",
      resolvedModel = "unknown",
    } = input;

    const warnings: string[] = [];
    // Pasar system prompt como parámetro separado 'system' de generateText,
    // NO como mensaje con role "system" en el array messages,
    // para evitar el warning de seguridad del AI SDK.
    const modelMessages = buildModelMessages(system, messages);
    const sdkTools = buildSdkTools(tools);
    const maxSteps = computeMaxSteps(stopWhen);

    try {
      const result = (await generateText({
        model: resolvedModel as LanguageModel,
        system,
        messages: modelMessages,
        tools: sdkTools as Record<string, { description: string; inputSchema: z.ZodType<Record<string, unknown>> }>,
        stopWhen: stepCountIs(maxSteps),
      })) as unknown as GenerateTextToolResult;

      // 🐛 Debug: log si el modelo devuelve respuesta vacía (sin texto, sin tool calls)
      const hasEmptyResponse = !result.text && (!result.toolCalls || result.toolCalls.length === 0);
      if (hasEmptyResponse) {
        console.warn(
          '[ADAPTER-DEBUG] generateText returned EMPTY |',
          `finishReason=${result.finishReason}`,
          `toolCalls=${result.toolCalls?.length ?? 0}`,
          `steps=${result.steps?.length ?? 0}`,
          `provider=${provider}`,
        );
      }

      const toolCalls = extractToolCalls(result);
      const finishReason = determineFinishReason(result.finishReason, toolCalls, stopWhen);

      return {
        messages: [
          ...messages,
          { role: "assistant" as const, content: result.text },
        ],
        toolCalls,
        finishReason,
        provider,
        model: typeof resolvedModel === "string" ? resolvedModel : "unknown",
        usage: {
          promptTokens: result.usage.inputTokens ?? result.usage.promptTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? result.usage.completionTokens ?? 0,
          totalTokens:
            result.usage.totalTokens ??
            (result.usage.inputTokens ?? result.usage.promptTokens ?? 0) +
              (result.usage.outputTokens ?? result.usage.completionTokens ?? 0),
        },
        warnings,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error desconocido en Vercel AI SDK";
      warnings.push(errorMsg);

      return {
        messages,
        toolCalls: [],
        finishReason: "error",
        provider,
        model: typeof resolvedModel === "string" ? resolvedModel : "unknown",
        warnings,
      };
    }
  }
}

/**
 * Factory function para crear el adapter.
 */
export function createVercelSdkAdapter(): AgentVercelSdkAdapter {
  return new VercelSdkAdapter();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildModelMessages(
  _system: string,
  messages: AgentLoopMessage[],
): ModelMessage[] {
  // NOTA: el system prompt se pasa como parámetro 'system' de generateText(),
  // NO como mensaje en el array. Solo devolvemos los mensajes de conversación.
  return messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
}

function buildSdkTools(
  tools: AgentSdkToolDefinition[],
): Record<string, { description: string; inputSchema: z.ZodType<Record<string, unknown>> }> {
  const result: Record<string, { description: string; inputSchema: z.ZodType<Record<string, unknown>> }> = {};

  for (const tool of tools) {
    result[tool.name] = {
      description: tool.description,
      inputSchema: tool.inputSchema,
    };
  }

  return result;
}

function computeMaxSteps(stopWhen: AgentVercelSdkLoopInput["stopWhen"]): number {
  switch (stopWhen) {
    case "tool_limit":
      return AGENT_LIMITS.maxToolCalls;
    case "approval_boundary":
      return Math.min(4, AGENT_LIMITS.maxToolCalls);
    case "final_text":
    default:
      return Math.min(5, AGENT_LIMITS.maxToolCalls);
  }
}

function determineFinishReason(
  sdkFinishReason: string,
  toolCalls: AgentToolCall[],
  stopWhen: AgentVercelSdkLoopInput["stopWhen"],
): string {
  if (sdkFinishReason === "error") return "error";

  if (stopWhen === "approval_boundary" && toolCalls.length > 0) {
    return "approval_boundary";
  }

  if (stopWhen === "tool_limit" && toolCalls.length >= AGENT_LIMITS.maxToolCalls) {
    return "tool_limit";
  }

  return sdkFinishReason || "stop";
}

function extractToolCalls(result: GenerateTextToolResult): AgentToolCall[] {
  const toolCalls: AgentToolCall[] = [];

  if (result.toolCalls && Array.isArray(result.toolCalls)) {
    for (const call of result.toolCalls) {
      toolCalls.push({
        id: call.toolCallId,
        name: call.toolName,
        arguments: call.args ?? {},
      });
    }
  }

  if (result.steps && result.steps.length > 0) {
    const lastStep = result.steps[result.steps.length - 1];
    if (lastStep.toolCalls) {
      for (const call of lastStep.toolCalls) {
        if (!toolCalls.some((tc) => tc.id === call.toolCallId)) {
          toolCalls.push({
            id: call.toolCallId,
            name: call.toolName,
            arguments: call.args ?? {},
          });
        }
      }
    }
  }

  return toolCalls;
}
