import { AI_REQUIRED_MODELS, resolveAiModel, summarizeAvailableModels, type AiAction, type AiModelResolution } from "@/lib/ai/models";
import { getProviderFallbackChain } from "@/lib/ai/gateway/router";
import type { AiProviderId, KhipuAiTask } from "@/lib/ai/gateway/types";
import { listInstalledOllamaModels } from "@/lib/ai/ollama";
import { getAiProviderSettings } from "@/lib/data/settings";
import { getSystemSettings } from "@/lib/data/system-settings";

type FetchLike = typeof fetch;

export type AiHealthStatus = "ok" | "degraded" | "down";

export type AiActionMetric = {
  latencyMs: number | null;
  lastError: string | null;
};

export type AiHealth = {
  status: AiHealthStatus;
  ollamaReachable: boolean;
  availableModels: string[];
  requiredModels: ReturnType<typeof summarizeAvailableModels>;
  actions: Record<AiAction, Omit<AiModelResolution, "action">>;
  metrics: Record<AiAction, AiActionMetric>;
  providers: Record<Exclude<AiProviderId, "auto">, AiProviderHealth>;
  routing: Record<KhipuAiTask, Exclude<AiProviderId, "auto">[]>;
};

export type AiProviderHealth = {
  configured: boolean;
  reachable: boolean | null;
};

const aiMetricsState: Record<AiAction, AiActionMetric> = {
  chat: { latencyMs: null, lastError: null },
  apu: { latencyMs: null, lastError: null },
  review: { latencyMs: null, lastError: null },
  autocomplete: { latencyMs: null, lastError: null },
  json: { latencyMs: null, lastError: null },
};

export async function getAiHealth(fetchImpl?: FetchLike, userId?: string): Promise<AiHealth> {
  try {
    const availableModels = await listInstalledOllamaModels(fetchImpl);
    const actions = buildActionResolutions(availableModels);
    const warningsCount = Object.values(actions).filter((action) => action.fallbackUsed || action.warnings.length > 0).length;

    let cloudConfigured = { openai: false, gemini: false, openrouter: false };
    if (userId) {
      try {
        const cloudSettings = await getAiProviderSettings(userId);
        cloudConfigured = {
          openai: cloudSettings.openaiConfigured,
          gemini: cloudSettings.geminiConfigured,
          openrouter: cloudSettings.openrouterConfigured,
        };
      } catch {
        // Cloud status is best-effort
      }
    }

    // Also check system settings for fallback keys
    if (!cloudConfigured.openai || !cloudConfigured.gemini || !cloudConfigured.openrouter) {
      try {
        const systemSettings = await getSystemSettings();
        cloudConfigured = {
          openai: cloudConfigured.openai || systemSettings.openaiConfigured,
          gemini: cloudConfigured.gemini || systemSettings.geminiConfigured,
          openrouter: cloudConfigured.openrouter || systemSettings.openrouterConfigured,
        };
      } catch {
        // System settings check is best-effort
      }
    }

    return {
      status: warningsCount > 0 ? "degraded" : "ok",
      ollamaReachable: true,
      availableModels,
      requiredModels: summarizeAvailableModels(availableModels),
      actions,
      metrics: cloneMetrics(),
      providers: buildProviderHealth(true, cloudConfigured),
      routing: buildRoutingHealth(),
    };
  } catch (error) {
    let cloudConfigured = { openai: false, gemini: false, openrouter: false };
    if (userId) {
      try {
        const cloudSettings = await getAiProviderSettings(userId);
        cloudConfigured = {
          openai: cloudSettings.openaiConfigured,
          gemini: cloudSettings.geminiConfigured,
          openrouter: cloudSettings.openrouterConfigured,
        };
      } catch {
        // Cloud status is best-effort
      }
    }

    // Also check system settings for fallback keys
    if (!cloudConfigured.openai || !cloudConfigured.gemini || !cloudConfigured.openrouter) {
      try {
        const systemSettings = await getSystemSettings();
        cloudConfigured = {
          openai: cloudConfigured.openai || systemSettings.openaiConfigured,
          gemini: cloudConfigured.gemini || systemSettings.geminiConfigured,
          openrouter: cloudConfigured.openrouter || systemSettings.openrouterConfigured,
        };
      } catch {
        // System settings check is best-effort
      }
    }

    return {
      status: "down",
      ollamaReachable: false,
      availableModels: [],
      requiredModels: AI_REQUIRED_MODELS.map((model) => ({ model, installed: false, actions: [] })),
      actions: buildUnavailableActionResolutions(error),
      metrics: cloneMetrics(),
      providers: buildProviderHealth(false, cloudConfigured),
      routing: buildRoutingHealth(),
    };
  }
}

export function recordAiActionMetric(action: AiAction, metric: Partial<AiActionMetric>) {
  aiMetricsState[action] = {
    latencyMs: metric.latencyMs ?? aiMetricsState[action].latencyMs,
    lastError: metric.lastError ?? aiMetricsState[action].lastError,
  };
}

function buildActionResolutions(availableModels: string[]) {
  return {
    chat: omitAction(resolveAiModel("chat", availableModels)),
    apu: omitAction(resolveAiModel("apu", availableModels)),
    review: omitAction(resolveAiModel("review", availableModels)),
    autocomplete: omitAction(resolveAiModel("autocomplete", availableModels)),
    json: omitAction(resolveAiModel("json", availableModels)),
  };
}

function buildUnavailableActionResolutions(error: unknown): Record<AiAction, Omit<AiModelResolution, "action">> {
  const warning = error instanceof Error ? error.message : "No se pudo consultar el estado de Ollama.";

  return {
    chat: {
      requestedModel: "llama3.1",
      model: "llama3.1",
      fallbackUsed: false,
      warnings: [warning],
    },
    apu: {
      requestedModel: "mistral",
      model: "llama3.1",
      fallbackUsed: true,
      warnings: [warning],
    },
    review: {
      requestedModel: "qwen2.5-coder:7b",
      model: "deepseek-coder",
      fallbackUsed: true,
      warnings: [warning],
    },
    autocomplete: {
      requestedModel: "mistral",
      model: "llama3.1",
      fallbackUsed: true,
      warnings: [warning],
    },
    json: {
      requestedModel: "qwen2.5-coder:7b",
      model: "deepseek-coder",
      fallbackUsed: true,
      warnings: [warning],
    },
  };
}

function omitAction(resolution: AiModelResolution): Omit<AiModelResolution, "action"> {
  return {
    requestedModel: resolution.requestedModel,
    model: resolution.model,
    fallbackUsed: resolution.fallbackUsed,
    warnings: resolution.warnings,
  };
}

function cloneMetrics(): Record<AiAction, AiActionMetric> {
  return {
    chat: { ...aiMetricsState.chat },
    apu: { ...aiMetricsState.apu },
    review: { ...aiMetricsState.review },
    autocomplete: { ...aiMetricsState.autocomplete },
    json: { ...aiMetricsState.json },
  };
}

function buildProviderHealth(
  ollamaReachable: boolean,
  cloudConfigured?: { openai: boolean; gemini: boolean; openrouter: boolean },
): AiHealth["providers"] {
  return {
    ollama: {
      configured: true,
      reachable: ollamaReachable,
    },
    openai: {
      configured: (cloudConfigured?.openai ?? false) || hasEnvValue(process.env.OPENAI_API_KEY),
      reachable: null,
    },
    gemini: {
      configured: (cloudConfigured?.gemini ?? false) || hasEnvValue(process.env.GEMINI_API_KEY),
      reachable: null,
    },
    openrouter: {
      configured: (cloudConfigured?.openrouter ?? false) || hasEnvValue(process.env.OPENROUTER_API_KEY),
      reachable: null,
    },
    chatgpt_bridge: {
      configured: true,
      reachable: null,
    },
  };
}

function buildRoutingHealth(): AiHealth["routing"] {
  const tasks: KhipuAiTask[] = [
    "review_apu",
    "generate_apu",
    "suggest_insumos",
    "review_budget",
    "generate_partida",
    "review_formula_polinomica",
    "review_quantity_takeoff",
    "montecarlo_risk_analysis",
    "chat",
    "autocomplete",
  ];

  return Object.fromEntries(
    tasks.map((task) => [task, getProviderFallbackChain({ provider: "auto", task })]),
  ) as AiHealth["routing"];
}

function hasEnvValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}
