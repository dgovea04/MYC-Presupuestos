import { AI_REQUIRED_MODELS, resolveAiModel, summarizeAvailableModels, type AiAction, type AiModelResolution } from "@/lib/ai/models";
import { listInstalledOllamaModels } from "@/lib/ai/ollama";

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
};

const aiMetricsState: Record<AiAction, AiActionMetric> = {
  chat: { latencyMs: null, lastError: null },
  apu: { latencyMs: null, lastError: null },
  review: { latencyMs: null, lastError: null },
  autocomplete: { latencyMs: null, lastError: null },
  json: { latencyMs: null, lastError: null },
};

export async function getAiHealth(fetchImpl?: FetchLike): Promise<AiHealth> {
  try {
    const availableModels = await listInstalledOllamaModels(fetchImpl);
    const actions = buildActionResolutions(availableModels);
    const warningsCount = Object.values(actions).filter((action) => action.fallbackUsed || action.warnings.length > 0).length;

    return {
      status: warningsCount > 0 ? "degraded" : "ok",
      ollamaReachable: true,
      availableModels,
      requiredModels: summarizeAvailableModels(availableModels),
      actions,
      metrics: cloneMetrics(),
    };
  } catch (error) {
    return {
      status: "down",
      ollamaReachable: false,
      availableModels: [],
      requiredModels: AI_REQUIRED_MODELS.map((model) => ({ model, installed: false, actions: [] })),
      actions: buildUnavailableActionResolutions(error),
      metrics: cloneMetrics(),
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
      requestedModel: "llama3.1",
      model: "llama3.1",
      fallbackUsed: false,
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
