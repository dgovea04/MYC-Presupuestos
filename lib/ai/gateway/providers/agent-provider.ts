import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getAgentModelShortLabel } from "@/lib/ai/agent/models";
import type { AiEndpointResult } from "@/lib/ai/types";
import type { AiProviderRequest, AiProviderResult } from "@/lib/ai/gateway/types";
import { createVercelSdkAdapter } from "@/lib/ai/agent/vercel-sdk-adapter";
import { createToolRegistry } from "@/lib/ai/agent/tool-registry";
import { createPolicyEngine } from "@/lib/ai/agent/policy-engine";
import { createToolExecutor } from "@/lib/ai/agent/tool-executor";
import { allTools } from "@/lib/ai/agent/tools";
import type { AgentLoopMessage } from "@/lib/ai/agent/contracts";

export const DEFAULT_AGENT_MODEL = "deepseek/deepseek-chat-v3-0324:free";

/** Máximo de iteraciones del loop agéntico externo. */
const MAX_AGENT_LOOP_ITERATIONS = 5;

/**
 * Agent Provider — ejecuta el loop agéntico usando el Vercel AI SDK adapter
 * con tool registry, policy engine y tool executor.
 *
 * Internamente usa OpenRouter como backend de modelo.
 * Las herramientas se ejecutan con validación Zod y evaluación de políticas.
 * Herramientas que requieren aprobación (write, financial, export) detienen
 * el loop y notifican al usuario.
 */
export async function executeAgentProvider(
  request: AiProviderRequest,
): Promise<AiProviderResult> {
  const startTime = Date.now();

  // ── 1. Resolver API key y modelo ──────────────────────────────────────────
  const apiKey =
    request.apiKey ||
    process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Se requiere una API key de OpenRouter para usar el agente.");
  }

  const requestedModel =
    request.modelPreference ||
    process.env.OPENROUTER_MODEL ||
    DEFAULT_AGENT_MODEL;

  // ── 2. Crear LanguageModel via OpenRouter ─────────────────────────────────
  const fetchImpl: typeof fetch = request.fetchImpl ?? fetch;
  const openrouter = createOpenRouter({
    apiKey,
    fetch: fetchImpl,
    appName: "MC Presupuestos",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://myc-presupuestos.local",
  });
  const languageModel = openrouter.chat(requestedModel);

  // ── 3. Inicializar machinery agéntica ─────────────────────────────────────
  const registry = createToolRegistry();
  for (const tool of allTools) {
    registry.register(tool);
  }

  const policyEngine = createPolicyEngine();
  const toolExecutor = createToolExecutor(registry, policyEngine);
  const adapter = createVercelSdkAdapter();

  // ── 4. Extraer system prompt y mensajes de conversación ───────────────────
  const systemPrompt =
    request.messages.find((m) => m.role === "system")?.content ?? "";

  const conversationMessages: AgentLoopMessage[] = request.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as AgentLoopMessage["role"],
      content: m.content,
    }));

  // ── 5. Loop agéntico ──────────────────────────────────────────────────────
  let iterations = 0;
  let totalToolCalls = 0;
  const allWarnings: string[] = [];
  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  while (iterations < MAX_AGENT_LOOP_ITERATIONS) {
    iterations++;

    const output = await adapter.runLoop({
      system: systemPrompt,
      messages: conversationMessages,
      tools: registry.toSdkDefinitions(),
      stopWhen: "approval_boundary",
      provider: "openrouter",
      resolvedModel: languageModel,
    });

    // Acumular usage
    if (output.usage) {
      totalUsage.promptTokens += output.usage.promptTokens;
      totalUsage.completionTokens += output.usage.completionTokens;
      totalUsage.totalTokens += output.usage.totalTokens;
    }
    allWarnings.push(...output.warnings);

    // Actualizar mensajes de conversación con lo que devolvió el adapter
    conversationMessages.length = 0;
    conversationMessages.push(
      ...output.messages.filter((m) => m.role !== "system"),
    );

    // Error del adapter — priorizar sobre cualquier otro resultado
    if (output.finishReason === "error") {
      return {
        answer: `Error del agente: ${allWarnings.join("; ")}`,
        provider: "agent",
        model: requestedModel,
        requestedModel,
        fallbackUsed: false,
        warnings: allWarnings,
        latencyMs: Date.now() - startTime,
        requestBody: {
          systemPrompt: systemPrompt.slice(0, 200),
          iterations,
          totalToolCalls,
          finishReason: "error",
        },
      };
    }

    // Sin tool calls → respuesta final
    if (output.toolCalls.length === 0) {
      const finalAnswer = extractFinalAnswer(conversationMessages);
      return {
        answer: finalAnswer || "El agente no generó una respuesta.",
        provider: "agent",
        model: requestedModel,
        requestedModel,
        fallbackUsed: false,
        warnings: allWarnings,
        latencyMs: Date.now() - startTime,
        requestBody: {
          systemPrompt: systemPrompt.slice(0, 200),
          iterations,
          totalToolCalls,
          usage: totalUsage,
        },
      };
    }

    // ── Procesar tool calls ─────────────────────────────────────────────────
    totalToolCalls += output.toolCalls.length;
    const toolResults: Array<{
      toolName: string;
      success: boolean;
      summary: string;
    }> = [];

    for (const toolCall of output.toolCalls) {
      const result = await toolExecutor.execute({
        toolCall,
        userId: request.userId ?? "unknown",
        projectId: request.projectId,
        executionId: `agent_${Date.now()}_${iterations}`,
        mode: "chat",
      });

      toolResults.push({
        toolName: toolCall.name,
        success: result.success,
        summary: result.summary,
      });

      // Si alguna herramienta requiere aprobación, detener el loop
      if (result.approvalRequired) {
        return {
          answer: buildApprovalMessage(toolResults, result.approvalRequired),
          provider: "agent",
          model: requestedModel,
          requestedModel,
          fallbackUsed: false,
          warnings: [
            ...allWarnings,
            `Herramienta "${toolCall.name}" requiere aprobación: ${result.approvalRequired.reason}`,
          ],
          latencyMs: Date.now() - startTime,
          requestBody: {
            systemPrompt: systemPrompt.slice(0, 200),
            iterations,
            totalToolCalls,
            approvalRequired: result.approvalRequired,
          },
        };
      }
    }

    // Alimentar resultados de herramientas al modelo
    conversationMessages.push({
      role: "user",
      content: buildToolResultsMessage(toolResults),
    });
  }

  // ── Límite de iteraciones alcanzado ───────────────────────────────────────
  const finalAnswer = extractFinalAnswer(conversationMessages);
  allWarnings.push(
    `Límite de ${MAX_AGENT_LOOP_ITERATIONS} iteraciones del agente alcanzado.`,
  );

  return {
    answer: finalAnswer || "El agente alcanzó el límite máximo de iteraciones.",
    provider: "agent",
    model: requestedModel,
    requestedModel,
    fallbackUsed: false,
    warnings: allWarnings,
    latencyMs: Date.now() - startTime,
    requestBody: {
      systemPrompt: systemPrompt.slice(0, 200),
      iterations,
      totalToolCalls,
      usage: totalUsage,
      limitReached: true,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractFinalAnswer(messages: AgentLoopMessage[]): string {
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  if (assistantMessages.length === 0) return "";

  const last = assistantMessages[assistantMessages.length - 1];
  return last.content.trim();
}

function buildToolResultsMessage(
  results: Array<{ toolName: string; success: boolean; summary: string }>,
): string {
  const lines = results.map(
    (r) =>
      `- ${r.success ? "✓" : "✗"} ${r.toolName}: ${r.summary}`,
  );

  return [
    "Resultados de las herramientas ejecutadas:",
    ...lines,
    "",
    "Continúa con el siguiente paso o proporciona tu respuesta final al usuario.",
  ].join("\n");
}

function buildApprovalMessage(
  allResults: Array<{ toolName: string; success: boolean; summary: string }>,
  approval: { toolName: string; reason: string },
): string {
  const completedLines = allResults
    .filter((r) => r.success)
    .map((r) => `- ✓ ${r.toolName}: ${r.summary}`);

  const sections: string[] = [];

  if (completedLines.length > 0) {
    sections.push(
      "Herramientas ejecutadas:",
      ...completedLines,
      "",
    );
  }

  sections.push(
    `⚠️ **Se requiere tu aprobación** para ejecutar "${approval.toolName}":`,
    `> ${approval.reason}`,
  );

  return sections.join("\n");
}

// ─── Streaming Agent ───────────────────────────────────────────────────────────

export type StreamAgentEvent =
  | { type: "delta"; text: string }
  | { type: "final"; result: AiEndpointResult };

/**
 * Versión streaming del agente — ejecuta el loop agéntico y emite deltas
 * en cada iteración para que el frontend muestre progreso en tiempo real.
 */
export async function* streamAgentChat(
  request: AiProviderRequest,
): AsyncIterable<StreamAgentEvent> {
  const startTime = Date.now();

  // ── 1. Resolver API key y modelo ──────────────────────────────────────────
  const apiKey = request.apiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Se requiere una API key de OpenRouter para usar el agente.");
  }

  const requestedModel =
    request.modelPreference ||
    process.env.OPENROUTER_MODEL ||
    DEFAULT_AGENT_MODEL;

  // ── 2. Crear LanguageModel via OpenRouter ─────────────────────────────────
  const fetchImpl: typeof fetch = request.fetchImpl ?? fetch;
  const openrouter = createOpenRouter({
    apiKey,
    fetch: fetchImpl,
    appName: "MC Presupuestos",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://myc-presupuestos.local",
  });
  const languageModel = openrouter.chat(requestedModel);

  // ── 3. Inicializar machinery agéntica ─────────────────────────────────────
  const registry = createToolRegistry();
  for (const tool of allTools) {
    registry.register(tool);
  }

  const policyEngine = createPolicyEngine();
  const toolExecutor = createToolExecutor(registry, policyEngine);
  const adapter = createVercelSdkAdapter();

  // ── 4. Extraer system prompt y mensajes ───────────────────────────────────
  const systemPrompt =
    request.messages.find((m) => m.role === "system")?.content ?? "";

  const conversationMessages: AgentLoopMessage[] = request.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as AgentLoopMessage["role"],
      content: m.content,
    }));

  // ── 5. Loop agéntico con streaming ────────────────────────────────────────
  let iterations = 0;
  let totalToolCalls = 0;
  const allWarnings: string[] = [];
  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  yield { type: "delta", text: `🤖 Khipu Agente iniciando con ${getAgentModelShortLabel(requestedModel)}...\n\n` };

  while (iterations < MAX_AGENT_LOOP_ITERATIONS) {
    iterations++;

    const output = await adapter.runLoop({
      system: systemPrompt,
      messages: conversationMessages,
      tools: registry.toSdkDefinitions(),
      stopWhen: "approval_boundary",
      provider: "openrouter",
      resolvedModel: languageModel,
    });

    if (output.usage) {
      totalUsage.promptTokens += output.usage.promptTokens;
      totalUsage.completionTokens += output.usage.completionTokens;
      totalUsage.totalTokens += output.usage.totalTokens;
    }
    allWarnings.push(...output.warnings);

    conversationMessages.length = 0;
    conversationMessages.push(
      ...output.messages.filter((m) => m.role !== "system"),
    );

    // Error del adapter
    if (output.finishReason === "error") {
      const errorMsg = `Error del agente: ${allWarnings.join("; ")}`;
      yield { type: "delta", text: `\n❌ ${errorMsg}\n` };
      yield {
        type: "final",
        result: {
          answer: errorMsg,
          model: requestedModel,
          requestedModel,
          fallbackUsed: false,
          warnings: allWarnings,
          latencyMs: Date.now() - startTime,
          debug: {
            structuredParseStatus: "not_requested",
            rawAnswer: errorMsg,
            validationWarnings: allWarnings,
            requestBody: {
              systemPrompt: systemPrompt.slice(0, 200),
              iterations,
              totalToolCalls,
              finishReason: "error",
            },
          },
        },
      };
      return;
    }

    // Sin tool calls → respuesta final
    if (output.toolCalls.length === 0) {
      const finalAnswer = extractFinalAnswer(conversationMessages);
      if (finalAnswer) {
        yield { type: "delta", text: `\n${finalAnswer}\n` };
      }
      yield {
        type: "final",
        result: {
          answer: finalAnswer || "El agente no generó una respuesta.",
          model: requestedModel,
          requestedModel,
          fallbackUsed: false,
          warnings: allWarnings,
          latencyMs: Date.now() - startTime,
          debug: {
            structuredParseStatus: "not_requested",
            rawAnswer: finalAnswer,
            validationWarnings: allWarnings,
            requestBody: {
              systemPrompt: systemPrompt.slice(0, 200),
              iterations,
              totalToolCalls,
              usage: totalUsage,
            },
          },
        },
      };
      return;
    }

    // ── Procesar tool calls ─────────────────────────────────────────────────
    totalToolCalls += output.toolCalls.length;
    const toolResults: Array<{
      toolName: string;
      success: boolean;
      summary: string;
    }> = [];

    for (const toolCall of output.toolCalls) {
      yield { type: "delta", text: `🔧 Ejecutando ${toolCall.name}...\n` };

      const result = await toolExecutor.execute({
        toolCall,
        userId: request.userId ?? "unknown",
        projectId: request.projectId,
        executionId: `agent_${Date.now()}_${iterations}`,
        mode: "chat",
      });

      toolResults.push({
        toolName: toolCall.name,
        success: result.success,
        summary: result.summary,
      });

      yield {
        type: "delta",
        text: `  ${result.success ? "✓" : "✗"} ${result.summary}\n`,
      };

      if (result.approvalRequired) {
        const approvalMsg = buildApprovalMessage(toolResults, result.approvalRequired);
        yield { type: "delta", text: `\n${approvalMsg}\n` };
        yield {
          type: "final",
          result: {
            answer: approvalMsg,
            model: requestedModel,
            requestedModel,
            fallbackUsed: false,
            warnings: [
              ...allWarnings,
              `Herramienta "${toolCall.name}" requiere aprobación: ${result.approvalRequired.reason}`,
            ],
            latencyMs: Date.now() - startTime,
            debug: {
              structuredParseStatus: "not_requested",
              rawAnswer: approvalMsg,
              validationWarnings: allWarnings,
              requestBody: {
                systemPrompt: systemPrompt.slice(0, 200),
                iterations,
                totalToolCalls,
                approvalRequired: result.approvalRequired,
              },
            },
          },
        };
        return;
      }
    }

    // Alimentar resultados al modelo y continuar
    conversationMessages.push({
      role: "user",
      content: buildToolResultsMessage(toolResults),
    });

    yield { type: "delta", text: "\n💭 Analizando resultados...\n\n" };
  }

  // ── Límite de iteraciones ─────────────────────────────────────────────────
  const finalAnswer = extractFinalAnswer(conversationMessages);
  allWarnings.push(
    `Límite de ${MAX_AGENT_LOOP_ITERATIONS} iteraciones del agente alcanzado.`,
  );

  yield {
    type: "delta",
    text: `\n⚠️ ${allWarnings[allWarnings.length - 1]}\n`,
  };
  yield {
    type: "final",
    result: {
      answer: finalAnswer || "El agente alcanzó el límite máximo de iteraciones.",
      model: requestedModel,
      requestedModel,
      fallbackUsed: false,
      warnings: allWarnings,
      latencyMs: Date.now() - startTime,
      debug: {
        structuredParseStatus: "not_requested",
        rawAnswer: finalAnswer,
        validationWarnings: allWarnings,
        requestBody: {
          systemPrompt: systemPrompt.slice(0, 200),
          iterations,
          totalToolCalls,
          usage: totalUsage,
          limitReached: true,
        },
      },
    },
  };
}
