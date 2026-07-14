/**
 * Modelos disponibles para el agente Khipu.
 * Incluye modelos cloud (OpenRouter) y modelos locales (Ollama).
 * Curados para tareas de ingeniería de costos y presupuestos de construcción.
 */

export type AgentModelProvider = "openrouter" | "google" | "ollama";

export type AgentModelEntry = {
  id: string;
  label: string;
  category: string;
  cost: "free" | "paid" | "local";
  provider: AgentModelProvider;
  description: string;
};

export const AGENT_MODELS: readonly AgentModelEntry[] = [
  // ── OpenRouter (cloud) ──────────────────────────────────────────────────
  {
    id: "openrouter/free",
    label: "OpenRouter Free (recomendado)",
    category: "Económico",
    cost: "free",
    provider: "openrouter",
    description: "Ruta a modelos gratuitos disponibles en OpenRouter.",
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    category: "Premium",
    cost: "paid",
    provider: "openrouter",
    description: "Mejor razonamiento y precisión en tareas complejas.",
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    category: "Económico",
    cost: "paid",
    provider: "openrouter",
    description: "Rápido y económico para tareas simples.",
  },
  {
    id: "anthropic/claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    category: "Premium",
    cost: "paid",
    provider: "openrouter",
    description: "Excelente en análisis técnico y estructurado.",
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    category: "Premium",
    cost: "paid",
    provider: "openrouter",
    description: "Razonamiento técnico sólido y confiable.",
  },
  // ── Google AI (directo) ────────────────────────────────────────────────
  {
    id: "google/gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    category: "Rápido",
    cost: "paid",
    provider: "google",
    description: "Modelo directo de Google AI. Más rápido y moderno que 2.5 Flash Lite. Usa tu API key de Google Gemini.",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    category: "Premium",
    cost: "paid",
    provider: "google",
    description: "Modelo directo de Google AI. Excelente tool calling y razonamiento. Usa tu API key de Google Gemini.",
  },
  // ── Ollama (local) ─────────────────────────────────────────────────────
    {
    id: "ollama/qwen2.5:14b",
    label: "Qwen 2.5 14B (Local) ⭐",
    category: "Local",
    cost: "local",
    provider: "ollama",
    description: "Mejor opción local: tool calling superior, excelente español y razonamiento técnico. ~9 GB en Q4.",
  },
  {
    id: "ollama/mistral-small:22b",
    label: "Mistral Small 22B (Local)",
    category: "Local",
    cost: "local",
    provider: "ollama",
    description: "Mistral Small 22B vía Ollama. Fuerte en seguimiento de instrucciones y multilingüe. ~13 GB en Q4.",
  },
  {
    id: "ollama/llama3.1",
    label: "Llama 3.1 (Local)",
    category: "Local",
    cost: "local",
    provider: "ollama",
    description: "Modelo local Llama 3.1 vía Ollama. Buen rendimiento general, ~5 GB en Q4.",
  },
] as const;

export type AgentModelId = (typeof AGENT_MODELS)[number]["id"];

export type AgentModelCost = (typeof AGENT_MODELS)[number]["cost"];

export const DEFAULT_AGENT_MODEL = "openrouter/free" satisfies AgentModelId;

export const COST_EMOJI: Record<AgentModelCost, string> = {
  free: "🆓",
  paid: "💲",
  local: "🏠",
};

export const PROVIDER_BADGE: Record<AgentModelProvider, { label: string; className: string }> = {
  openrouter: { label: "Cloud", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  google: { label: "Google", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  ollama: { label: "Local", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

export function getAgentModelProvider(id: string): AgentModelProvider | undefined {
  return AGENT_MODELS.find((m) => m.id === id)?.provider;
}

export function getAgentModelCostEmoji(id: string): string {
  const model = AGENT_MODELS.find((m) => m.id === id);
  return model ? COST_EMOJI[model.cost] : "";
}

export function getAgentModelLabel(id: string): string {
  const model = AGENT_MODELS.find((m) => m.id === id);
  return model?.label ?? id;
}

export function getAgentModelShortLabel(id: string): string {
  const model = AGENT_MODELS.find((m) => m.id === id);
  if (!model) return id;
  // Si es Ollama, extraer nombre del modelo: "ollama/llama3.1" → "llama3.1"
  // Si es OpenRouter, extraer: "openai/gpt-4o" → "gpt-4o"
  const parts = model.id.split("/");
  return parts[parts.length - 1];
}
