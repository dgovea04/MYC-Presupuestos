import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getAgentModelProvider, getAgentModelShortLabel } from "@/lib/ai/agent/models";
import type { AiEndpointResult } from "@/lib/ai/types";
import type { AiProviderRequest, AiProviderResult, KhipuAiTask } from "@/lib/ai/gateway/types";
import { createVercelSdkAdapter } from "@/lib/ai/agent/vercel-sdk-adapter";
import { createToolRegistry } from "@/lib/ai/agent/tool-registry";
import { createPolicyEngine } from "@/lib/ai/agent/policy-engine";
import { createToolExecutor } from "@/lib/ai/agent/tool-executor";
import { allTools } from "@/lib/ai/agent/tools";
import type { AgentLoopMessage } from "@/lib/ai/agent/contracts";
import type { AgentExecutionMode } from "@/lib/ai/agent/types";
import { prisma } from "@/lib/db/prisma";

export const DEFAULT_AGENT_MODEL = "openrouter/free";

/** Máximo de iteraciones del loop agéntico externo. */
const MAX_AGENT_LOOP_ITERATIONS = 5;

/**
 * Convierte un KhipuAiTask en un AgentExecutionMode para el policy engine.
 *
 * - "chat" y "autocomplete" → modo "chat" (escritura permitida sin aprobación)
 * - Cualquier otra tarea (generate_apu, review_budget, etc.) → modo "goal"
 *   (herramientas write requieren aprobación del usuario)
 */
function taskToExecutionMode(task: KhipuAiTask): AgentExecutionMode {
  if (task === "chat" || task === "autocomplete") return "chat";
  return "goal";
}

/**
 * Límite de llamadas por herramienta dentro de una misma conversación.
 * Si una herramienta excede este límite, se bloquea y se informa al modelo
 * para que no la vuelva a llamar. Previene loops infinitos.
 */
const TOOL_CALL_LIMITS: Partial<Record<string, number>> = {
  searchProjects: 2,
  generateBudget: 2,
};

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
  const apiKey = request.apiKey;

  if (!apiKey) {
    throw new Error(
      "No hay API key configurada para el agente. " +
      "Ve a Configuración > IA > Proveedores Cloud IA y agrega tu API key de OpenRouter.",
    );
  }

  const requestedModel =
    request.modelPreference ||
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

  // Contador de llamadas por herramienta para evitar loops
  const toolCallCounts = new Map<string, number>();

  /**
   * Detecta cuando el LLM repite la misma tool fallida con el mismo error.
   * Si ocurre 2 veces seguidas, detenemos el loop temprano para evitar
   * gastar iteraciones en un ciclo sin progreso.
   */
  let lastFailedTool: { name: string; summary: string } | null = null;
  let consecutiveRepeatFailures = 0;

  // ── Derivar provider real del modelo seleccionado ───────────────────────
  const provider = getAgentModelProvider(requestedModel) ?? "openrouter";

  // Contador de reintentos para respuestas vacías del modelo
  let emptyResponseRetries = 0;
  const MAX_EMPTY_RETRIES = 2;

  while (iterations < MAX_AGENT_LOOP_ITERATIONS) {
    iterations++;

    // Guardar mensajes antes de actualizar (para poder revertir si la respuesta es vacía)
    const previousMessages = conversationMessages.map((m) => ({ ...m }));

    const output = await adapter.runLoop({
      system: systemPrompt,
      messages: conversationMessages,
      tools: registry.toSdkDefinitions(),
      stopWhen: "approval_boundary",
      provider,
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

    // Sin tool calls → respuesta final (con reintento si está vacía)
    if (output.toolCalls.length === 0) {
      const finalAnswer = extractFinalAnswer(conversationMessages);
      if (!finalAnswer && emptyResponseRetries < MAX_EMPTY_RETRIES) {
        // Respuesta vacía: reintentar sin consumir una iteración del loop agéntico
        emptyResponseRetries++;
        iterations--; // no contar esta iteración
        conversationMessages.length = 0;
        conversationMessages.push(...previousMessages);
        continue;
      }
      return {
        answer: finalAnswer || "El agente no generó una respuesta tras varios intentos.",
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

      // Último mensaje del usuario para heredar argumentos faltantes
      const lastUserMessage = conversationMessages
        .filter((m) => m.role === "user")
        .pop()?.content;

    for (const toolCall of output.toolCalls) {
      // ── Verificar límite de llamadas para esta herramienta ────────────────
      const maxCalls = TOOL_CALL_LIMITS[toolCall.name];
      if (maxCalls !== undefined) {
        const currentCount = toolCallCounts.get(toolCall.name) ?? 0;
        if (currentCount >= maxCalls) {
          const limitMsg = `⚠️ Límite de ${maxCalls} llamadas a "${toolCall.name}" alcanzado en esta conversación. Usa los resultados que ya tienes o pide más información al usuario. No llames esta herramienta de nuevo.`;
          toolResults.push({
            toolName: toolCall.name,
            success: false,
            summary: limitMsg,
          });
          allWarnings.push(limitMsg);
          continue; // Saltar la ejecución de la herramienta
        }
        toolCallCounts.set(toolCall.name, currentCount + 1);
      }

      const result = await toolExecutor.execute({
        toolCall,
        userId: request.userId ?? "unknown",
        projectId: request.projectId,
        workspaceId: request.workspaceId,
        executionId: `agent_${Date.now()}_${iterations}`,
        mode: taskToExecutionMode(request.task),
        lastUserMessage,
        messages: conversationMessages.map((m) => ({ role: m.role, content: m.content })),
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

    // ── Detectar tool repetida fallida (mismo nombre + mismo error) ───────
    const failedTools = toolResults.filter((r) => !r.success);
    const hasRepeatedFailure =
      failedTools.length === 1 &&
      toolResults.length === 1 &&
      lastFailedTool !== null &&
      lastFailedTool.name === failedTools[0].toolName &&
      lastFailedTool.summary === failedTools[0].summary;

    if (hasRepeatedFailure) {
      consecutiveRepeatFailures++;
      if (consecutiveRepeatFailures >= 2) {
        allWarnings.push(
          `Herramienta "${failedTools[0].toolName}" falló ${consecutiveRepeatFailures} veces seguidas con el mismo error. Loop detenido para evitar gastar iteraciones.`,
        );
        break;
      }
    } else if (failedTools.length > 0) {
      // Nueva falla (o distinta) — registrar para la próxima iteración
      lastFailedTool = {
        name: failedTools[0].toolName,
        summary: failedTools[0].summary,
      };
      consecutiveRepeatFailures = 1;
    } else {
      // Alguna herramienta tuvo éxito → resetear tracker
      lastFailedTool = null;
      consecutiveRepeatFailures = 0;
    }

    // Alimentar resultados de herramientas al modelo
    conversationMessages.push({
      role: "user",
      content: buildToolResultsMessage(toolResults),
    });
  }

  // ── Límite de iteraciones alcanzado o loop detenido por fallo repetido ──
  const finalAnswer = extractFinalAnswer(conversationMessages);
  const limitReached = iterations >= MAX_AGENT_LOOP_ITERATIONS;

  if (limitReached) {
    allWarnings.push(
      `Límite de ${MAX_AGENT_LOOP_ITERATIONS} iteraciones del agente alcanzado.`,
    );
  }

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
      limitReached,
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

  const allSucceeded = results.every((r) => r.success);
  const guidance = allSucceeded
    ? "Continúa con el siguiente paso o proporciona tu respuesta final al usuario."
    : "ALGUNAS HERRAMIENTAS FALLARON. Revisa los campos faltantes o inválidos indicados arriba y corrige SOLO esos campos al reintentar. NO repitas la misma llamada con los mismos argumentos inválidos.";

  return [
    "Resultados de las herramientas ejecutadas:",
    ...lines,
    "",
    guidance,
  ].join("\n");
}

function buildApprovalMessage(
  allResults: Array<{ toolName: string; success: boolean; summary: string }>,
  approval: { approvalId: string; toolName: string; reason: string },
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
    `⏸️ approval_id=${approval.approvalId}`,
    `⚠️ **Se requiere tu aprobación** para ejecutar "${approval.toolName}":`,
    `> ${approval.reason}`,
  );

  return sections.join("\n");
}

// ─── Streaming Agent ───────────────────────────────────────────────────────────

export type StreamAgentEvent =
  | { type: "delta"; text: string }
  | { type: "tool_start"; toolName: string }
  | { type: "tool_result"; toolName: string; success: boolean; summary: string; latencyMs: number }
  | { type: "approval_required"; approvalId: string; toolName: string; reason: string }
  | { type: "final"; result: AiEndpointResult };

/**
 * Versión streaming del agente — ejecuta el loop agéntico y emite deltas
 * en cada iteración para que el frontend muestre progreso en tiempo real.
 */
export async function* streamAgentChat(
  request: AiProviderRequest,
  /** LanguageModel pre-construido (opcional). Si se provee, se usa en vez de crear uno via OpenRouter. */
  prebuiltModel?: unknown,
): AsyncIterable<StreamAgentEvent> {
  const startTime = Date.now();

  let requestedModel =
    request.modelPreference ||
    DEFAULT_AGENT_MODEL;

  // ── 1. Resolver LanguageModel ────────────────────────────────────────────
  let languageModel: unknown;

  if (prebuiltModel) {
    // Usar modelo pre-construido (ej: Ollama via openai-compatible)
    languageModel = prebuiltModel;
  } else {
    // OpenRouter (default)
    const apiKey = request.apiKey;
    if (!apiKey) {
      throw new Error(
        "No hay API key configurada para el agente. " +
        "Ve a Configuración > IA > Proveedores Cloud IA y agrega tu API key de OpenRouter.",
      );
    }

    const fetchImpl: typeof fetch = request.fetchImpl ?? fetch;
    const openrouter = createOpenRouter({
      apiKey,
      fetch: fetchImpl,
      appName: "MC Presupuestos",
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://myc-presupuestos.local",
    });
    languageModel = openrouter.chat(requestedModel);
  }

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

  // Contador de llamadas por herramienta para evitar loops
  const toolCallCounts = new Map<string, number>();

  /**
   * Detecta cuando el LLM repite la misma tool fallida con el mismo error.
   * Si ocurre 2 veces seguidas, detenemos el loop temprano para evitar
   * gastar iteraciones en un ciclo sin progreso.
   */
  let lastFailedTool: { name: string; summary: string } | null = null;
  let consecutiveRepeatFailures = 0;

  // Contador de reintentos para respuestas vacías del modelo
  let emptyResponseRetries = 0;
  const MAX_EMPTY_RETRIES = 2;

  // ── Derivar provider real del modelo seleccionado ───────────────────────
  let provider = getAgentModelProvider(requestedModel) ?? "openrouter";

  yield { type: "delta", text: `🤖 Khipu Agente iniciando con ${getAgentModelShortLabel(requestedModel)}...\n\n` };

  // ── Persist ledger: crear AgentExecution (solo si hay userId válido) ─────
  let executionId: string | null = null;
  if (request.userId) {
    try {
      const execution = await prisma.agentExecution.create({
        data: {
          userId: request.userId,
        projectId: request.projectId ?? null,
        mode: taskToExecutionMode(request.task),
        state: "EXECUTING",
        goal: request.messages.find((m) => m.role === "user")?.content.slice(0, 500) ?? "Chat",
        provider,
        model: requestedModel,
          contextSnapshotJson: (request.projectId ? { projectId: request.projectId } : null) as any,
        },
      });
      executionId = execution.id;
    } catch {
      // Non-blocking: ledger persistence failure should not break the agent
    }
  }

  while (iterations < MAX_AGENT_LOOP_ITERATIONS) {
    iterations++;

    // Guardar mensajes antes de actualizar (para poder revertir si la respuesta es vacía)
    const previousMessages = conversationMessages.map((m) => ({ ...m }));

    const output = await adapter.runLoop({
      system: systemPrompt,
      messages: conversationMessages,
      tools: registry.toSdkDefinitions(),
      stopWhen: "approval_boundary",
      provider,
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
      // Update ledger with failed state
      if (executionId) {
        try {
          await prisma.agentExecution.update({
            where: { id: executionId },
            data: { state: "FAILED", lastError: errorMsg, finishedAt: new Date() },
          });
        } catch { /* non-blocking */ }
      }
      return;
    }

    // Sin tool calls → respuesta final (con reintento si está vacía)
    if (output.toolCalls.length === 0) {
      const finalAnswer = extractFinalAnswer(conversationMessages);
      if (!finalAnswer && emptyResponseRetries < MAX_EMPTY_RETRIES) {
        // Respuesta vacía: reintentar con el mismo modelo
        emptyResponseRetries++;
        iterations--;
        yield { type: "delta", text: "\n🔄 Reintentando...\n" };
        conversationMessages.length = 0;
        conversationMessages.push(...previousMessages);
        continue;
      }

      if (finalAnswer) {
        yield { type: "delta", text: `\n${finalAnswer}\n` };
        // Update ledger with completed state
        if (executionId) {
          try {
            await prisma.agentExecution.update({
              where: { id: executionId },
              data: {
                state: "EXECUTED",
                summary: finalAnswer?.slice(0, 500) ?? null,
                finishedAt: new Date(),
              },
            });
          } catch { /* non-blocking */ }
        }
      } else {
        const errorMsg = "El agente no generó una respuesta tras varios intentos.";
        yield { type: "delta", text: `\n❌ ${errorMsg}\n` };
        // Update ledger with failed state
        if (executionId) {
          try {
            await prisma.agentExecution.update({
              where: { id: executionId },
              data: {
                state: "FAILED",
                lastError: errorMsg,
                finishedAt: new Date(),
              },
            });
          } catch { /* non-blocking */ }
        }
      }
      yield {
        type: "final",
        result: {
          answer: finalAnswer || "El agente no generó una respuesta tras varios intentos.",
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

      // Último mensaje del usuario para heredar argumentos faltantes
      const lastUserMessage = conversationMessages
        .filter((m) => m.role === "user")
        .pop()?.content;

    for (const toolCall of output.toolCalls) {
      // ── Verificar límite de llamadas para esta herramienta ────────────────
      const maxCalls = TOOL_CALL_LIMITS[toolCall.name];
      if (maxCalls !== undefined) {
        const currentCount = toolCallCounts.get(toolCall.name) ?? 0;
        if (currentCount >= maxCalls) {
          const limitMsg = `⚠️ Límite de ${maxCalls} llamadas a "${toolCall.name}" alcanzado. No puedes volver a usar esta herramienta. Analiza los resultados anteriores o pide más información al usuario.`;
          yield { type: "delta", text: `  ✗ ${limitMsg}\n` };
          toolResults.push({
            toolName: toolCall.name,
            success: false,
            summary: limitMsg,
          });
          continue; // Saltar la ejecución de la herramienta
        }
        toolCallCounts.set(toolCall.name, currentCount + 1);
      }

      yield { type: "tool_start", toolName: toolCall.name };
      yield { type: "delta", text: `🔧 Ejecutando ${toolCall.name}...\n` };

      const toolStartTime = Date.now();
      const result = await toolExecutor.execute({
        toolCall,
        userId: request.userId ?? "unknown",
        projectId: request.projectId,
        workspaceId: request.workspaceId,
        executionId: executionId ?? `agent_${Date.now()}_${iterations}`,
        mode: taskToExecutionMode(request.task),
        lastUserMessage,
        messages: conversationMessages.map((m) => ({ role: m.role, content: m.content })),
      });

      // Persist tool invocation in ledger
      if (executionId) {
        try {
          await prisma.agentToolInvocation.create({
            data: {
              executionId,
              toolName: toolCall.name,
              argumentsJson: (toolCall.arguments ?? {}) as any,
              resultJson: (result.toolResult.output ? { output: result.toolResult.output } : null) as any,
              latencyMs: Date.now() - toolStartTime,
              success: result.success,
              errorMessage: result.success ? null : result.summary,
            },
          });
        } catch {
          // Non-blocking
        }
      }

      toolResults.push({
        toolName: toolCall.name,
        success: result.success,
        summary: result.summary,
      });

      yield {
        type: "tool_result",
        toolName: toolCall.name,
        success: result.success,
        summary: result.summary,
        latencyMs: Date.now() - toolStartTime,
      };
      yield {
        type: "delta",
        text: `  ${result.success ? "✓" : "✗"} ${result.summary}\n`,
      };

      if (result.approvalRequired) {
        yield {
          type: "approval_required",
          approvalId: result.approvalRequired.approvalId,
          toolName: toolCall.name,
          reason: result.approvalRequired.reason,
        };
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
        // Update ledger with pending approval state
        if (executionId) {
          try {
            await prisma.agentExecution.update({
              where: { id: executionId },
              data: { state: "PENDING_APPROVAL", summary: approvalMsg.slice(0, 500) },
            });
          } catch { /* non-blocking */ }
        }
        return;
      }
    }

    // ── Detectar tool repetida fallida (mismo nombre + mismo error) ───────
    const failedTools = toolResults.filter((r) => !r.success);
    const hasRepeatedFailure =
      failedTools.length === 1 &&
      toolResults.length === 1 &&
      lastFailedTool !== null &&
      lastFailedTool.name === failedTools[0].toolName &&
      lastFailedTool.summary === failedTools[0].summary;

    if (hasRepeatedFailure) {
      consecutiveRepeatFailures++;
      if (consecutiveRepeatFailures >= 2) {
        const repeatMsg = `⚠️ Herramienta "${failedTools[0].toolName}" falló ${consecutiveRepeatFailures} veces seguidas con el mismo error. Loop detenido para evitar gastar iteraciones.\n`;
        yield { type: "delta", text: `\n${repeatMsg}\n` };
        allWarnings.push(repeatMsg.trim());

        const stuckAnswer = extractFinalAnswer(conversationMessages);
        yield {
          type: "final",
          result: {
            answer: stuckAnswer || `La herramienta "${failedTools[0].toolName}" sigue fallando con el mismo error.`,
            model: requestedModel,
            requestedModel,
            fallbackUsed: false,
            warnings: allWarnings,
            latencyMs: Date.now() - startTime,
            debug: {
              structuredParseStatus: "not_requested",
              rawAnswer: stuckAnswer,
              validationWarnings: allWarnings,
              requestBody: {
                systemPrompt: systemPrompt.slice(0, 200),
                iterations,
                totalToolCalls,
                usage: totalUsage,
                repeatedFailure: true,
                failedTool: failedTools[0].toolName,
              },
            },
          },
        };
        // Update ledger with failed state
        if (executionId) {
          try {
            await prisma.agentExecution.update({
              where: { id: executionId },
              data: {
                state: "FAILED",
                lastError: repeatMsg.trim(),
                finishedAt: new Date(),
              },
            });
          } catch { /* non-blocking */ }
        }
        return;
      }
    } else if (failedTools.length > 0) {
      // Nueva falla (o distinta) — registrar para la próxima iteración
      lastFailedTool = {
        name: failedTools[0].toolName,
        summary: failedTools[0].summary,
      };
      consecutiveRepeatFailures = 1;
    } else {
      // Alguna herramienta tuvo éxito → resetear tracker
      lastFailedTool = null;
      consecutiveRepeatFailures = 0;
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
  const limitReached = iterations >= MAX_AGENT_LOOP_ITERATIONS;

  if (limitReached) {
    allWarnings.push(
      `Límite de ${MAX_AGENT_LOOP_ITERATIONS} iteraciones del agente alcanzado.`,
    );
  }

  if (limitReached) {
    yield {
      type: "delta",
      text: `\n⚠️ ${allWarnings[allWarnings.length - 1]}\n`,
    };
  }
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
          limitReached,
        },
      },
    },
  };
}
