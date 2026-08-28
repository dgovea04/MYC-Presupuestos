import crypto from "node:crypto";
import { trackServerEvent } from "@/lib/analytics/events";
import { withAiRoute } from "@/lib/ai/route-handler";
import type { AiMessage } from "@/lib/ai/types";
import { aiAgentRequestSchema } from "@/lib/ai/agent/validation";
import { streamAgentChat } from "@/lib/ai/gateway/providers/agent-provider";
import { recordPlatformAiUsage } from "@/lib/ai/usage-scope";
import { getDecryptedOpenrouterApiKey, getDecryptedGeminiApiKey, getAiProviderSettings } from "@/lib/data/settings";
import { getSystemSettings } from "@/lib/data/system-settings";
import {
  getWorkflowTemplate,
  getBundleBySlug,
} from "@/lib/ai/agent/workflows";
import { getAgentModelProvider } from "@/lib/ai/agent/models";
import { prisma } from "@/lib/db/prisma";
import { createOllama } from "ollama-ai-provider-v2";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { detectAgentIntent, type AgentPendingAction } from "@/lib/ai/agent/intent-router";
import { buildAgentSystemPrompt } from "@/lib/ai/agent/prompt-builder";
import { AiRuntimeError } from "@/lib/ai/errors";
import { isLocalRuntimeEnabled } from "@/lib/runtime/local-capabilities";
import { assertAiCapabilityAccess } from "@/lib/ai/route-access-matrix";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { resolveAiCredential } from "@/lib/ai/credentials/resolver";
import { isScopedAiResolverEnabled } from "@/lib/ai/credentials/rollout";
import { estimateAiTokens } from "@/lib/ai/service";
import { reserveAiUsage, recordScopedAiUsage, releaseAiUsage } from "@/lib/ai/usage-scope";

const encoder = new TextEncoder();
const STREAM_PREAMBLE = `: ${" ".repeat(2048)}\n\n`;

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
    const workspaceId = data.workspaceId ?? session.user.activeCompanyId ?? session.user.companyId ?? null;

    // El workspace enviado por el cliente nunca se considera autorizado por sí
    // mismo. Se valida exactamente el contexto que usará el agente y sus tools.
    if (workspaceId) {
      await assertAiCapabilityAccess({
        userId: session.user.id,
        workspaceId,
        capability: "agent",
      });
    } else {
      await assertFeatureAccess({ userId: session.user.id, feature: "khipu.agent" });
    }

    if (data.projectId && workspaceId) {
      const project = await prisma.project.findFirst({
        where: {
          id: data.projectId,
          companyId: workspaceId,
          company: { memberships: { some: { userId: session.user.id, status: "ACTIVE" } } },
        },
        select: { id: true },
      });
      if (!project) {
        return new Response(JSON.stringify({ error: "El proyecto no pertenece al workspace autorizado." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // ── Resolver contexto del workspace ────────────────────────────────────
    let workspaceName: string | null = null;
    if (workspaceId) {
      try {
        const company = await prisma.company.findUnique({
          where: { id: workspaceId },
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
    if (workspaceId) {
      try {
        const projects = await prisma.project.findMany({
          where: {
            companyId: workspaceId,
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

    // ── Resolver modelo y provider desde la configuración del usuario, con
    // fallback al agentModel a nivel de sistema si el usuario no eligió uno.
    // Solo cargamos settings del sistema si los del usuario están vacíos, para
    // evitar una consulta DB extra en el caso común (usuario ya eligió modelo).
    const settings = await getAiProviderSettings(session.user.id);
    let systemSettings: Awaited<ReturnType<typeof getSystemSettings>> | null = null;
    if (!settings.agentModel && !settings.openrouterModel) {
      systemSettings = await getSystemSettings();
    }
    const modelPreference =
      settings.agentModel ||
      settings.openrouterModel ||
      systemSettings?.agentModel ||
      systemSettings?.openrouterModel ||
      undefined;
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
      workspaceId: workspaceId ?? undefined,
      pendingAction,
    });

    // ── Detectar si el usuario nombró un proyecto que coincide con recentProjects ─
    const extractedProjectName = intent.extracted.projectName?.toLowerCase().trim();
    const namedProjectMatch = extractedProjectName
      ? recentProjectRecords.find(
          (p) =>
            // Exact match first (case-insensitive)
            p.name.toLowerCase() === extractedProjectName ||
            // Then fuzzy: project name contains the extracted name (e.g., "San Felipe" in "San Felipe 2")
            p.name.toLowerCase().includes(extractedProjectName),
        ) ?? null
      : null;

    // ── Construir prompt modular ──────────────────────────────────────────
    const systemPrompt = buildAgentSystemPrompt({
      intent,
      workspace: workspaceName && workspaceId
        ? { id: workspaceId, name: workspaceName }
        : null,
      recentProjects: recentProjectRecords,
      workflow: workflowContext,
      provider: provider ?? "unknown",
      namedProjectMatch: namedProjectMatch
        ? { id: namedProjectMatch.id, name: namedProjectMatch.name }
        : null,
    });

    // ── Resolver API key según provider ────────────────────────────────────
    // En producción, el resolver scoped es la única fuente autorizada para
    // Workspace/USER credentials; el fallback legacy solo se conserva durante
    // la migración controlada.
    const credentialProvider = provider === "google" ? "gemini" : provider === "ollama" ? "ollama" : "agent";
    const scopedCredential = workspaceId && isScopedAiResolverEnabled()
      ? await resolveAiCredential({
          userId: session.user.id,
          workspaceId,
          teamId: data.teamId,
          projectId: data.projectId,
          provider: credentialProvider,
          task: "chat",
          modelPreference,
        })
      : null;
    const effectiveModelPreference = scopedCredential?.model || modelPreference;
    let apiKey: string | undefined;
    let geminiApiKey: string | undefined;

    if (scopedCredential) {
      if (provider === "google") geminiApiKey = scopedCredential.apiKey ?? undefined;
      else apiKey = scopedCredential.apiKey ?? undefined;
    } else if (provider === "google") {
      geminiApiKey = await getDecryptedGeminiApiKey(session.user.id);
    } else if (provider !== "ollama") {
      apiKey = await getDecryptedOpenrouterApiKey(session.user.id);
    }

    // ── Construir LanguageModel según el provider del modelo ──────────────
    if (provider === "ollama" && !isLocalRuntimeEnabled()) {
      throw new AiRuntimeError("local_only", "Ollama solo esta disponible en la app local.");
    }

    let prebuiltModel: unknown = undefined;

    if (provider === "google" && effectiveModelPreference && geminiApiKey) {
      const googleProvider = createGoogleGenerativeAI({ apiKey: geminiApiKey });
      const googleModelName = effectiveModelPreference.split("/").slice(1).join("/");
      prebuiltModel = googleProvider(googleModelName);
    } else if (provider === "ollama" && effectiveModelPreference) {
      const ollamaConfig: { baseURL?: string } = {};
      if (process.env.OLLAMA_BASE_URL) {
        ollamaConfig.baseURL = `${process.env.OLLAMA_BASE_URL.replace(/\/$/, "")}/api`;
      }
      const ollamaProvider = createOllama(ollamaConfig);
      const ollamaModelName = effectiveModelPreference.split("/").slice(1).join("/");
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

          const requestId = data.requestId ?? crypto.randomUUID();
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
          const estimatedTokens = estimateAiTokens(conversationMessages.map((message) => message.content).join("\n"));
          const platformAccounting = Boolean(scopedCredential && scopedCredential.billingScope === "PLATFORM");
          const scopedAccounting = Boolean(scopedCredential && scopedCredential.billingScope !== "PLATFORM");
          let reservation: { estimatedTokens: number; estimatedCostMinor?: number; periodStart: Date } | null = null;
          let accountingSettled = false;

          if (scopedAccounting && scopedCredential) {
            reservation = await reserveAiUsage({
              userId: session.user.id,
              workspaceId,
              billingScope: scopedCredential.billingScope,
              estimatedTokens,
              allowance: scopedCredential.tokenLimit,
              budgetMinor: scopedCredential.budgetLimitMinor,
              provider: scopedCredential.provider,
              model: scopedCredential.model,
              action: "chat",
              credentialSource: scopedCredential.credentialSource,
              credentialId: scopedCredential.credentialId,
              requestId,
              hardLimit: scopedCredential.hardLimit,
              alertThresholds: scopedCredential.alertThresholds,
            });
          }

          try {
            for await (const event of streamAgentChat({
            task: "chat",
            messages: conversationMessages,
            userId: session.user.id,
            projectId: data.projectId,              workspaceId: workspaceId ?? undefined,
              apiKey,
            modelPreference: effectiveModelPreference ?? undefined,
            allowAgentWrites: scopedCredential?.allowAgentWrites ?? true,
            requestId,
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
              void trackServerEvent("khipu_used", {
                userId: session.user.id,
                companyId: session.user.activeCompanyId ?? session.user.companyId,
                action_type: "agent_stream",
                provider: "agent",
              }).catch(() => undefined);
                if (reservation && scopedCredential) {
                  await recordScopedAiUsage({
                    userId: session.user.id,
                    workspaceId,
                    billingScope: scopedCredential.billingScope,
                    credentialSource: scopedCredential.credentialSource,
                    credentialId: scopedCredential.credentialId,
                    requestId,
                    provider: scopedCredential.provider,
                    model: effectiveModelPreference || scopedCredential.model,
                    action: "chat",
                    estimatedTokens: reservation.estimatedTokens,
                    actualTokens: estimateAiTokens(`${conversationMessages.map((message) => message.content).join("\n")}\n${event.result.answer}`),
                    reservedCostMinor: reservation.estimatedCostMinor ?? null,
                    periodStart: reservation.periodStart,
                  });
                  accountingSettled = true;
                } else if (platformAccounting && scopedCredential) {
                  // Uso facturado a la plataforma (key del sistema): registro
                  // independiente en el ledger con atribución, sin tocar el cupo
                  // del usuario ni del workspace.
                  await recordPlatformAiUsage({
                    userId: session.user.id,
                    workspaceId,
                    requestId,
                    provider: scopedCredential.provider,
                    model: effectiveModelPreference || scopedCredential.model,
                    action: "chat",
                    estimatedTokens,
                    actualTokens: estimateAiTokens(`${conversationMessages.map((message) => message.content).join("\n")}\n${event.result.answer}`),
                  });
                }
                writeEvent(controller, "final", {
                  answer: event.result.answer,
                  warnings: event.result.warnings ?? [],
                  latencyMs: event.result.latencyMs,
                });
            }
            }
          } finally {
            if (reservation && scopedCredential && !accountingSettled) {
              await releaseAiUsage({
                userId: session.user.id,
                workspaceId,
                billingScope: scopedCredential.billingScope,
                estimatedTokens: reservation.estimatedTokens,
                provider: scopedCredential.provider,
                model: effectiveModelPreference || scopedCredential.model,
                action: "chat",
                credentialSource: scopedCredential.credentialSource,
                credentialId: scopedCredential.credentialId,
                requestId,
                estimatedCostMinor: reservation.estimatedCostMinor ?? null,
                periodStart: reservation.periodStart,
              }).catch(() => undefined);
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
