export const AI_MODELS = {
  CHAT: "llama3.1",
  APU: "mistral",
  REVIEW: "llama3.1",
  AUTOCOMPLETE: "mistral",
  QWEN_CODE: "qwen2.5-coder:7b",
  CODE: "deepseek-coder",
  CODE_V2: "deepseek-coder-v2",
} as const;

export type AiModel = (typeof AI_MODELS)[keyof typeof AI_MODELS];

export type AiAction = "chat" | "apu" | "review" | "autocomplete" | "json";

type AiActionModelConfig = {
  requestedModel: AiModel;
  fallbackModel?: AiModel;
};

export type AiModelResolution = {
  action: AiAction;
  requestedModel: AiModel;
  model: AiModel;
  fallbackUsed: boolean;
  warnings: string[];
};

export type AiRequiredModelSummary = {
  model: AiModel;
  installed: boolean;
  actions: AiAction[];
};

export const AI_MODEL_LABELS: Record<AiModel, string> = {
  "llama3.1": "Llama 3.1",
  mistral: "Mistral",
  "qwen2.5-coder:7b": "Qwen2.5 Coder 7B",
  "deepseek-coder": "DeepSeek Coder",
  "deepseek-coder-v2": "DeepSeek Coder V2",
};

const AI_ACTION_MODELS: Record<AiAction, AiActionModelConfig> = {
  chat: {
    requestedModel: AI_MODELS.CHAT,
  },
  apu: {
    requestedModel: AI_MODELS.APU,
    fallbackModel: AI_MODELS.CHAT,
  },
  review: {
    requestedModel: AI_MODELS.REVIEW,
  },
  autocomplete: {
    requestedModel: AI_MODELS.AUTOCOMPLETE,
    fallbackModel: AI_MODELS.CHAT,
  },
  json: {
    requestedModel: AI_MODELS.QWEN_CODE,
    fallbackModel: AI_MODELS.CODE,
  },
};

export const AI_REQUIRED_MODELS: AiModel[] = [AI_MODELS.CHAT, AI_MODELS.APU, AI_MODELS.QWEN_CODE, AI_MODELS.CODE];

export function resolveAiModel(action: AiAction, availableModels: string[]): AiModelResolution {
  const config = AI_ACTION_MODELS[action];
  const requestedInstalled = isModelInstalled(config.requestedModel, availableModels);

  if (requestedInstalled) {
    return {
      action,
      requestedModel: config.requestedModel,
      model: config.requestedModel,
      fallbackUsed: false,
      warnings: [],
    };
  }

  if (config.fallbackModel && isModelInstalled(config.fallbackModel, availableModels)) {
    return {
      action,
      requestedModel: config.requestedModel,
      model: config.fallbackModel,
      fallbackUsed: true,
      warnings: [
        `Falta instalar ${config.requestedModel} en Ollama para ${action}. Se usa ${config.fallbackModel} como fallback local.`,
      ],
    };
  }

  if (config.fallbackModel) {
    throw new Error(
      `Falta instalar ${config.requestedModel} en Ollama para ${action}. Tambien se intento usar ${config.fallbackModel} como fallback, pero no esta disponible.`,
    );
  }

  throw new Error(`Falta instalar ${config.requestedModel} en Ollama para ${action}.`);
}

export function summarizeAvailableModels(availableModels: string[]): AiRequiredModelSummary[] {
  return AI_REQUIRED_MODELS.map((model) => ({
    model,
    installed: isModelInstalled(model, availableModels),
    actions: getActionsForModel(model),
  }));
}

function getActionsForModel(model: AiModel): AiAction[] {
  const supportedActions = new Set<AiAction>();
  const actionOrder: AiAction[] = ["chat", "review", "apu", "autocomplete", "json"];

  for (const [action, config] of Object.entries(AI_ACTION_MODELS) as [AiAction, AiActionModelConfig][]) {
    if (config.requestedModel === model || config.fallbackModel === model) {
      supportedActions.add(action);
    }
  }

  return actionOrder.filter((action) => supportedActions.has(action));
}

function isModelInstalled(model: AiModel, availableModels: string[]) {
  return availableModels.some((availableModel) => normalizeModelName(availableModel) === model);
}

export function normalizeModelName(model: string) {
  const trimmed = model.trim();
  if (trimmed.startsWith("qwen2.5-coder:7b")) return AI_MODELS.QWEN_CODE;
  const normalized = trimmed.split(":")[0]?.trim() ?? trimmed;
  if (normalized === "qwen2.5-coder") return AI_MODELS.QWEN_CODE;
  if (normalized === "deepseek-code-v2" || normalized === "deepseel-coder-v2") return AI_MODELS.CODE_V2;
  if (normalized === "deepseek-code") return AI_MODELS.CODE;
  return normalized;
}
