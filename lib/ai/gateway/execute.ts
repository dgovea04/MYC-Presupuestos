import { buildKhipuAssembledContext } from "@/lib/ai/context/assembled-context";
import { stableHash } from "@/lib/ai/gateway/hash";
import { getProviderFallbackChain, resolveAiProvider } from "@/lib/ai/gateway/router";
import type { AiProviderId, AiProviderRequest, AiProviderResult, ExecuteAiTaskInput } from "@/lib/ai/gateway/types";
import type { AiEndpointResult } from "@/lib/ai/types";
import { executeAgentProvider } from "@/lib/ai/gateway/providers/agent-provider";
import { executeBridgeProvider } from "@/lib/ai/gateway/providers/bridge-provider";
import { executeGeminiProvider } from "@/lib/ai/gateway/providers/gemini-provider";
import { executeOllamaProvider } from "@/lib/ai/gateway/providers/ollama-provider";
import { executeOpenAIProvider } from "@/lib/ai/gateway/providers/openai-provider";
import { executeOpenRouterProvider } from "@/lib/ai/gateway/providers/openrouter-provider";
import { buildSkillProviderRequest } from "@/lib/ai/skills/registry";
import { getDecryptedOpenaiApiKey, getDecryptedGeminiApiKey, getDecryptedOpenrouterApiKey, getAiProviderSettings } from "@/lib/data/settings";
import { getSystemSettings } from "@/lib/data/system-settings";

type ExecutableProviderId = Exclude<AiProviderId, "auto">;

export type AiProviderExecutor = (request: AiProviderRequest) => Promise<AiProviderResult>;

export type ExecuteAiTaskDeps = {
  buildKhipuAssembledContext: typeof buildKhipuAssembledContext;
  providers: Partial<Record<ExecutableProviderId, AiProviderExecutor>>;
};

export type ExecuteAiTaskWithDepsInput = ExecuteAiTaskInput & {
  deps?: Partial<ExecuteAiTaskDeps>;
};

const DEFAULT_PROVIDERS: Record<ExecutableProviderId, AiProviderExecutor> = {
  ollama: executeOllamaProvider,
  openai: executeOpenAIProvider,
  gemini: executeGeminiProvider,
  openrouter: executeOpenRouterProvider,
  chatgpt_bridge: executeBridgeProvider,
  agent: executeAgentProvider,
};

export async function executeAiTask({
  deps,
  payload,
  projectId,
  provider,
  task,
  userId,
}: ExecuteAiTaskWithDepsInput): Promise<AiProviderResult> {
  const resolvedDeps = resolveDeps(deps);
  const assembledContext = await resolvedDeps.buildKhipuAssembledContext({
    projectId,
    userId,
    task,
    payload,
  });
  const baseRequest = buildProviderRequest({
    assembledContext,
    payload,
    task,
    userId,
    projectId,
  });

  // Inject user API keys and model preferences when targeting cloud providers
  const resolvedProvider = resolveAiProvider({ provider, task });
  const request = await enrichProviderRequest(baseRequest, resolvedProvider, userId);

  const providers = getProviderFallbackChain({ provider, task });
  const promptHash = stableHash(request.messages);
  let lastError: unknown;

  for (const providerId of providers) {
    const executor = resolvedDeps.providers[providerId];

    if (!executor) {
      lastError = new Error(`Proveedor ${providerId} no disponible`);
      continue;
    }

    try {
      const result = await executor(request);
      const currentProviderIndex = providers.indexOf(providerId);
      const fallbackUsed = currentProviderIndex > 0;
      const enrichedDebug: AiEndpointResult["debug"] = {
        structuredParseStatus: "not_requested",
        rawAnswer: result.answer,
        context: request.messages.find((m) => m.role === "system")?.content ?? undefined,
        messages: request.messages,
        ai: {
          answer: result.answer,
          rawAnswer: result.answer,
          structuredParseStatus: "not_requested",
        },
        fallback: {
          used: fallbackUsed,
          reason: fallbackUsed
            ? `Se uso ${providerId} como fallback tras intentar con ${providers.slice(0, currentProviderIndex).join(", ")}`
            : undefined,
        },
        validationWarnings: result.warnings,
        requestBody: result.requestBody,
      };

      return {
        ...result,
        provider: result.provider ?? providerId,
        task,
        promptHash,
        responseHash: stableHash(result.answer),
        debug: enrichedDebug,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No se pudo ejecutar la tarea de IA.");
}

async function enrichProviderRequest(
  request: AiProviderRequest,
  resolvedProvider: Exclude<AiProviderId, "auto">,
  userId?: string,
): Promise<AiProviderRequest> {
  if (resolvedProvider === "openai") {
    // 1. Try user key first
    if (userId) {
      const [apiKey, settings] = await Promise.all([
        getDecryptedOpenaiApiKey(userId),
        getAiProviderSettings(userId),
      ]);
      if (apiKey) {
        return { ...request, apiKey, modelPreference: settings.openaiModel || undefined };
      }
    }

    // 2. Fall back to system settings (single DB call returns key + model)
    const systemSettings = await getSystemSettings();
    if (systemSettings.openaiApiKey) {
      return {
        ...request,
        apiKey: systemSettings.openaiApiKey,
        modelPreference: systemSettings.openaiModel || request.modelPreference,
      };
    }
  }

  if (resolvedProvider === "gemini") {
    // 1. Try user key first
    if (userId) {
      const [apiKey, settings] = await Promise.all([
        getDecryptedGeminiApiKey(userId),
        getAiProviderSettings(userId),
      ]);
      if (apiKey) {
        return { ...request, apiKey, modelPreference: settings.geminiModel || undefined };
      }
    }

    // 2. Fall back to system settings (single DB call returns key + model)
    const systemSettings = await getSystemSettings();
    if (systemSettings.geminiApiKey) {
      return {
        ...request,
        apiKey: systemSettings.geminiApiKey,
        modelPreference: systemSettings.geminiModel || request.modelPreference,
      };
    }
  }

  if (resolvedProvider === "openrouter") {
    if (userId) {
      const [apiKey, settings] = await Promise.all([
        getDecryptedOpenrouterApiKey(userId),
        getAiProviderSettings(userId),
      ]);
      if (apiKey) {
        return { ...request, apiKey, modelPreference: settings.openrouterModel || undefined };
      }
    }

    const systemSettings = await getSystemSettings();
    if (systemSettings.openrouterApiKey) {
      return {
        ...request,
        apiKey: systemSettings.openrouterApiKey,
        modelPreference: systemSettings.openrouterModel || request.modelPreference,
      };
    }
  }

  if (resolvedProvider === "agent") {
    // Agent usa OpenRouter como backend, pero prefiere el agentModel guardado
    // por el Khipu Agente tanto a nivel usuario como de sistema; si no existe,
    // cae al openrouterModel de Proveedores Cloud IA (legacy safety).
    if (userId) {
      const [apiKey, settings] = await Promise.all([
        getDecryptedOpenrouterApiKey(userId),
        getAiProviderSettings(userId),
      ]);
      if (apiKey) {
        const agentModelPreference = settings.agentModel || settings.openrouterModel || undefined;
        return { ...request, apiKey, modelPreference: agentModelPreference };
      }
    }

    const systemSettings = await getSystemSettings();
    if (systemSettings.openrouterApiKey) {
      return {
        ...request,
        apiKey: systemSettings.openrouterApiKey,
        modelPreference:
          systemSettings.agentModel || systemSettings.openrouterModel || request.modelPreference,
      };
    }
  }

  return request;
}

function resolveDeps(deps: Partial<ExecuteAiTaskDeps> | undefined): ExecuteAiTaskDeps {
  return {
    buildKhipuAssembledContext,
    providers: {
      ...DEFAULT_PROVIDERS,
      ...deps?.providers,
    },
    ...deps,
  };
}

function buildProviderRequest({
  assembledContext,
  payload,
  task,
  userId,
  projectId,
}: Parameters<typeof buildSkillProviderRequest>[0] & { projectId?: string }): AiProviderRequest {
  return {
    ...buildSkillProviderRequest({
      assembledContext,
      task,
      payload,
      userId,
    }),
    projectId,
    allowEnvironmentFallback: task !== "pdf_import_structure",
  };
}
