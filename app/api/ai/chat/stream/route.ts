import { trackServerEvent } from "@/lib/analytics/events";
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { buildChatMessages } from "@/lib/ai/prompts";
import { withAiRoute } from "@/lib/ai/route-handler";
import { streamChatAiResponse } from "@/lib/ai/service";
import { aiChatRequestSchema } from "@/lib/ai/validation";
import { resolveAiCredential } from "@/lib/ai/credentials/resolver";
import { isScopedAiResolverEnabled } from "@/lib/ai/credentials/rollout";
import { getAiProviderSettings, getDecryptedGeminiApiKey, getDecryptedOpenrouterApiKey, getDecryptedOpenaiApiKey } from "@/lib/data/settings";
import { getSystemSettings } from "@/lib/data/system-settings";
import type { AiProviderId } from "@/lib/ai/gateway/types";
import { isLocalRuntimeEnabled } from "@/lib/runtime/local-capabilities";
import { assertAiCapabilityAccess } from "@/lib/ai/route-access-matrix";

const encoder = new TextEncoder();
const STREAM_PREAMBLE = `: ${" ".repeat(2048)}\n\n`;

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiChatRequestSchema.parse(await request.json());
    const effectiveProvider: Exclude<AiProviderId, "auto"> = data.provider === "auto"
      ? (isLocalRuntimeEnabled() ? "ollama" : "openai")
      : data.provider as Exclude<AiProviderId, "auto">;
    if (effectiveProvider === "ollama" && !isLocalRuntimeEnabled()) {
      return new Response(JSON.stringify({ error: "Ollama solo esta disponible en la app local." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages = buildChatMessages(data);

    const settings = await getAiProviderSettings(session.user.id);
    const systemSettings = !settings.agentModel && !settings.openrouterModel ? await getSystemSettings() : null;
    const requestedModelPreference = settings.agentModel || settings.openrouterModel || systemSettings?.agentModel || systemSettings?.openrouterModel;
    const modelPreference = data.modelPreference ?? requestedModelPreference;
    const workspaceId = data.workspaceId ?? session.user.activeCompanyId ?? session.user.companyId ?? null;
    if (workspaceId) await assertAiCapabilityAccess({ userId: session.user.id, workspaceId, capability: "chat" });
    const resolvedCredential = isScopedAiResolverEnabled()
      ? await resolveAiCredential({
          userId: session.user.id,
          workspaceId,
          provider: effectiveProvider,
          task: "chat",
          modelPreference,
        })
      : await resolveLegacyStreamCredential({
          userId: session.user.id,
          provider: effectiveProvider,
          modelPreference,
        });
    const streamInput: Parameters<typeof streamChatAiResponse>[0] = {
      messages,
      userId: session.user.id,
      projectId: data.projectId,
      workspaceId: resolvedCredential.workspaceId ?? undefined,
      provider: resolvedCredential.provider,
      apiKey: resolvedCredential.apiKey ?? undefined,
      modelPreference: resolvedCredential.model || undefined,
      credentialSource: resolvedCredential.credentialSource,
      credentialId: resolvedCredential.credentialId,
      billingScope: resolvedCredential.billingScope,
      requestId: data.requestId,
      tokenLimit: resolvedCredential.tokenLimit,
      budgetLimitMinor: resolvedCredential.budgetLimitMinor,
      hardLimit: resolvedCredential.hardLimit,
      alertThresholds: resolvedCredential.alertThresholds,
      allowAgentWrites: resolvedCredential.allowAgentWrites,
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          writePreamble(controller);

          for await (const event of streamChatAiResponse(streamInput)) {
            if (event.type === "delta") {
              writeEvent(controller, "delta", { text: event.text });
              continue;
            }

            const finalResult = await attachProjectHistoryEntry({
              action: "chat",
              context: data.context,
              projectId: data.projectId,
              result: event.result,
              summary: data.message,
              userId: session.user.id,
            });
            void trackServerEvent("khipu_used", {
              userId: session.user.id,
              companyId: session.user.activeCompanyId ?? session.user.companyId,
              action_type: "chat_stream",
              provider: effectiveProvider,
            }).catch(() => undefined);
            writeEvent(controller, "final", finalResult);
          }
        } catch (error) {
          writeEvent(controller, "error", {
            error: error instanceof Error ? error.message : "No se pudo completar la solicitud de IA.",
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
  }, { capability: "chat" });
}

async function resolveLegacyStreamCredential({
  userId,
  provider,
  modelPreference,
}: {
  userId: string;
  provider: "ollama" | "openai" | "gemini" | "openrouter" | "agent" | "chatgpt_bridge";
  modelPreference?: string;
}) {
  const settings = await getAiProviderSettings(userId);
  const system = await getSystemSettings();
  const apiKey = provider === "openai"
    ? await getDecryptedOpenaiApiKey(userId) || system.openaiApiKey || process.env.OPENAI_API_KEY || null
    : provider === "gemini"
      ? await getDecryptedGeminiApiKey(userId) || system.geminiApiKey || process.env.GEMINI_API_KEY || null
      : provider === "openrouter" || provider === "agent"
        ? await getDecryptedOpenrouterApiKey(userId) || system.openrouterApiKey || process.env.OPENROUTER_API_KEY || null
        : null;
  const selectedModel = modelPreference || (provider === "openai" ? settings.openaiModel || system.openaiModel : provider === "gemini" ? settings.geminiModel || system.geminiModel : settings.openrouterModel || system.openrouterModel);
  return {
    provider,
    credentialSource: apiKey ? "PLATFORM" as const : "ENVIRONMENT" as const,
    credentialId: null,
    apiKey,
    model: selectedModel,
    billingScope: "PLATFORM" as const,
    tokenLimit: null,
    budgetLimitMinor: null,
    hardLimit: true,
    alertThresholds: [],
    allowAgentWrites: true,
    fallbackAllowed: true,
    workspaceId: null,
    task: "chat" as const,
  };
}

function writePreamble(controller: ReadableStreamDefaultController<Uint8Array>) {
  controller.enqueue(encoder.encode(STREAM_PREAMBLE));
}

function writeEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}
