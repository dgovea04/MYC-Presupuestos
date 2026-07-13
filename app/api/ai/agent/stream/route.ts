import { withAiRoute } from "@/lib/ai/route-handler";
import type { AiMessage } from "@/lib/ai/types";
import { aiAgentRequestSchema } from "@/lib/ai/agent/validation";
import { streamAgentChat } from "@/lib/ai/gateway/providers/agent-provider";
import { getDecryptedOpenrouterApiKey, getDecryptedGeminiApiKey, getAiProviderSettings } from "@/lib/data/settings";
import {
  getWorkflowTemplate,
  getBundleBySlug,
} from "@/lib/ai/agent/workflows";
import { getAgentModelProvider } from "@/lib/ai/agent/models";
import { prisma } from "@/lib/db/prisma";
import { createOllama } from "ollama-ai-provider-v2";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { detectAgentIntent, type AgentIntent, type AgentPendingAction } from "@/lib/ai/agent/intent-router";
import { buildAgentSystemPrompt } from "@/lib/ai/agent/prompt-builder";

const encoder = new TextEncoder();
const STREAM_PREAMBLE = `: ${" ".repeat(2048)}\n\n`;

/** Tipos de eventos SSE que emite este endpoint. */
type AgentStreamEvent =
  | { type: "intent"; intent: Pick<AgentIntent, "type" | "confidence" | "reason" | "extracted" | "suggestedTools" | "requiredFields"> }
  | { type: "pending_action"; pendingAction: AgentPendingAction | null }
  | { type: "delta"; text: string }
  | { type: "tool_start"; toolName: string }
  | { type: "tool_result"; toolName: string; success: boolean; summary: string; latencyMs: number }
  | { type: "approval_required"; toolName: string; reason: string }
  | { type: "final"; answer: string; warnings: string[]; latencyMs: number }
  | { type: "error"; message: string };

/**
 * POST /api/ai/agent/stream
 *
 * Streaming SSE del agente Khipu. Emite eventos en tiempo real
 * para que el frontend actualice los 3 paneles del AgentWorkspace
 * (Chat, Plan de Ejecución, Herramientas/Aprobaciones/Actividad).
 *
 * Eventos emitidos:
 *   intent          — clasificación de la intención del usuario
 *   pending_action  — acción pendiente de confirmación (si existe)
 *   delta           — texto incremental para el chat
 *   tool_start      — una herramienta empezó a ejecutarse
 *   tool_result     — resultado de una herramienta (éxito/fallo)
 *   approval_required — se requiere aprobación humana
 *   final           — ejecución completada
 *   error           — error durante la ejecución
 */
export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiAgentRequestSchema.parse(await request.json());

    // ── Resolver contexto del workspace ────────────────────────────────────
    let workspaceName: string | null = null;
    if (data.workspaceId) {
      try {
        const company = await prisma.company.findUnique({
          where: { id: data.workspaceId },
          select: { name: true },
        });
        workspaceName = company?.name ?? null;
      } catch {
        // non-blocking
      }
    }

    // ── Resolver proyectos recientes del usuario ─────────────────────────
    const recentProjectRecords: Array<{
      id: string;
      name: string;
      clientName?: string | null;
      location?: string | null;
    }> = [];
    if (data.workspaceId) {
      try {
        const projects = await prisma.project.findMany({
          where: {
            companyId: data.workspaceId,
            company: {
              memberships: {
                some: {
                  userId: session.user.id,
                  status: "ACTIVE",
                },
              },
            },
          },
          select: {
            id: true,
            name: true,
            clientName: true,
            location: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        });
        recentProjectRecords.push(...projects);
      } catch {
        // non-blocking
      }
    }

    // ── Resolver bundle y workflow prompts ─────────────────────────────────
    let workflowContext: {
      id: string;
      name: string;
      bundleSlug: string;
      bundleName: string;
      bundleDescription: string;
      systemPrompt: string;
      initialGoal: string;
    } | null = null;
    if (data.workflowId) {
      const template = getWorkflowTemplate(data.workflowId);
      if (template) {
        const bundle = getBundleBySlug(template.bundleSlug);
        if (bundle) {
          workflowContext = {
            id: template.slug,
            name: template.name,
            bundleSlug: template.bundleSlug,
            bundleName: bundle.name,
            bundleDescription: bundle.description,
            systemPrompt: bundle.systemPrompt,
            initialGoal: template.initialGoal,
          };
        }
      }
    }

    // ── Resolver modelo y provider desde la configuración del usuario ─────
    const settings = await getAiProviderSettings(session.user.id);
    const modelPreference = settings.openrouterModel || undefined;
    const provider = modelPreference ? getAgentModelProvider(modelPreference) : undefined;

    // ── Detectar intención del usuario ─────────────────────────────────────
    const msgHistory = data.messages?.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    // Detectar si hay una acción pendiente (ej: previewBudgetGeneration ya ejecutado)
    const pendingAction = detectPendingActionFromHistory({
      currentMessage: data.message,
      messages: msgHistory,
      projectId: data.projectId,
    });

    const intent = detectAgentIntent({
      message: data.message,
      messages: msgHistory,
      mode: data.mode ?? "chat",
      workflowId: data.workflowId,
      projectId: data.projectId,
      workspaceId: data.workspaceId,
      pendingAction,
    });

    // ── Construir prompt modular ──────────────────────────────────────────
    const systemPrompt = buildAgentSystemPrompt({
      intent,
      workspace: workspaceName && data.workspaceId
        ? { id: data.workspaceId, name: workspaceName }
        : null,
      recentProjects: recentProjectRecords,
      workflow: workflowContext,
      provider: provider ?? "unknown",
    });

    // ── Resolver API key según provider ────────────────────────────────────
    let apiKey: string | undefined;
    let geminiApiKey: string | undefined;

    if (provider === "google") {
      geminiApiKey = await getDecryptedGeminiApiKey(session.user.id);
    } else if (provider !== "ollama") {
      apiKey = await getDecryptedOpenrouterApiKey(session.user.id);
    }

    // ── Construir LanguageModel según el provider del modelo ──────────────
    let prebuiltModel: unknown = undefined;

    if (provider === "google" && modelPreference && geminiApiKey) {
      const googleProvider = createGoogleGenerativeAI({ apiKey: geminiApiKey });
      const googleModelName = modelPreference.split("/").slice(1).join("/");
      prebuiltModel = googleProvider(googleModelName);
    } else if (provider === "ollama" && modelPreference) {
      const ollamaConfig: { baseURL?: string } = {};
      if (process.env.OLLAMA_BASE_URL) {
        ollamaConfig.baseURL = `${process.env.OLLAMA_BASE_URL.replace(/\/$/, "")}/api`;
      }
      const ollamaProvider = createOllama(ollamaConfig);
      const ollamaModelName = modelPreference.split("/").slice(1).join("/");
      prebuiltModel = ollamaProvider(ollamaModelName);
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          writePreamble(controller);

          // Emitir la intención detectada para que el frontend pueda mostrarla
          writeEvent(controller, "intent", {
            type: intent.type,
            confidence: intent.confidence,
            reason: intent.reason,
            extracted: intent.extracted,
            suggestedTools: intent.suggestedTools,
            requiredFields: intent.requiredFields,
          });

          // Emitir acción pendiente detectada (o null si no hay ninguna)
          // El frontend puede usar esto para mostrar/ocultar banners de confirmación
          writeEvent(controller, "pending_action", pendingAction);

          // Usar el historial completo si se provee (mantiene contexto entre turnos).
          const conversationMessages: AiMessage[] = data.messages && data.messages.length > 0
            ? [
                { role: "system" as const, content: systemPrompt },
                ...data.messages.map((m) => ({
                  role: m.role as AiMessage["role"],
                  content: m.content,
                })),
              ]
            : [
                { role: "system" as const, content: systemPrompt },
                { role: "user" as const, content: data.message },
              ];

          for await (const event of streamAgentChat({
            task: "chat",
            messages: conversationMessages,
            userId: session.user.id,
            projectId: data.projectId,
            workspaceId: data.workspaceId,
            apiKey,
            modelPreference: modelPreference,
          }, prebuiltModel)) {
            if (event.type === "tool_start") {
              writeEvent(controller, "tool_start", { toolName: event.toolName });
            }

            if (event.type === "tool_result") {
              writeEvent(controller, "tool_result", {
                toolName: event.toolName,
                success: event.success,
                summary: event.summary,
                latencyMs: event.latencyMs,
              });
            }

            if (event.type === "approval_required") {
              writeEvent(controller, "approval_required", {
                approvalId: event.approvalId,
                toolName: event.toolName,
                reason: event.reason,
              });
            }

            if (event.type === "delta") {
              writeEvent(controller, "delta", { text: event.text });
            }

            if (event.type === "final") {
              writeEvent(controller, "final", {
                answer: event.result.answer,
                warnings: event.result.warnings ?? [],
                latencyMs: event.result.latencyMs,
              });
            }
          }
        } catch (error) {
          writeEvent(controller, "error", {
            message: error instanceof Error ? error.message : "Error inesperado del agente.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}

function writePreamble(controller: ReadableStreamDefaultController<Uint8Array>) {
  controller.enqueue(encoder.encode(STREAM_PREAMBLE));
}

// ─── Pending action detection from history ─────────────────────────────────

/**
 * Escanea el historial de mensajes para detectar si hay una acción pendiente
 * (ej: el agente ejecutó previewBudgetGeneration y el usuario está confirmando).
 */
export function detectPendingActionFromHistory(input: {
  currentMessage: string;
  messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  projectId?: string;
}): AgentPendingAction | null {
  if (!input.messages || input.messages.length === 0) return null;

  // Buscar si el último mensaje del assistant contiene resultados de preview
  let previewFound = false;
  let lastConstructionDesc = "";

  for (let i = input.messages.length - 1; i >= 0; i--) {
    const msg = input.messages[i];
    if (msg.role === "assistant" && (
      msg.content.includes("previewBudgetGeneration") ||
      msg.content.includes("Vista previa") ||
      msg.content.includes("vista previa")
    )) {
      previewFound = true;
      break;
    }
  }

  if (!previewFound) return null;

  // Buscar la última descripción de construcción del usuario
  for (let i = input.messages.length - 1; i >= 0; i--) {
    const msg = input.messages[i];
    if (msg.role === "user" && msg.content.length > 30 &&
      !msg.content.startsWith("Confirmado") &&
      !msg.content.startsWith("No por ahora") &&
      !msg.content.startsWith("¡SÍ")) {
      lastConstructionDesc = msg.content;
      break;
    }
  }

  if (!input.projectId) return null;

  return {
    type: "apply_budget_generation",
    projectId: input.projectId,
    description: lastConstructionDesc,
    templateSource: "auto",
  };
}

function writeEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: string,
  data: unknown,
) {
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
  );
}
