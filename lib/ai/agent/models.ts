/**
 * Modelos disponibles para el agente Khipu via OpenRouter.
 * Curados para tareas de ingeniería de costos y presupuestos de construcción.
 */
export const AGENT_MODELS = [
  {
    id: "deepseek/deepseek-chat-v3-0324:free",
    label: "DeepSeek V3 (gratis)",
    category: "Económico",
    cost: "free" as const,
    description: "Rápido, gratuito, buen razonamiento general.",
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    category: "Premium",
    cost: "paid" as const,
    description: "Mejor razonamiento y precisión en tareas complejas.",
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    category: "Económico",
    cost: "paid" as const,
    description: "Rápido y económico para tareas simples.",
  },
  {
    id: "anthropic/claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    category: "Premium",
    cost: "paid" as const,
    description: "Excelente en análisis técnico y estructurado.",
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    category: "Premium",
    cost: "paid" as const,
    description: "Razonamiento técnico sólido y confiable.",
  },
  {
    id: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash",
    category: "Rápido",
    cost: "paid" as const,
    description: "Muy rápido, buena relación costo/calidad.",
  },
  {
    id: "google/gemini-2.5-pro-exp-03-25:free",
    label: "Gemini 2.5 Pro (gratis)",
    category: "Económico",
    cost: "free" as const,
    description: "Experimental gratuito con buena capacidad de razonamiento.",
  },
  {
    id: "meta-llama/llama-4-maverick:free",
    label: "Llama 4 Maverick (gratis)",
    category: "Económico",
    cost: "free" as const,
    description: "Open-source competitivo, gratuito.",
  },
] as const;

export type AgentModelId = (typeof AGENT_MODELS)[number]["id"];

export type AgentModelCost = (typeof AGENT_MODELS)[number]["cost"];

export const DEFAULT_AGENT_MODEL = "deepseek/deepseek-chat-v3-0324:free" satisfies AgentModelId;

export const COST_EMOJI: Record<AgentModelCost, string> = {
  free: "🆓",
  paid: "💲",
};

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
  // Extraer nombre corto: "GPT-4o" de "openai/gpt-4o"
  const parts = model.id.split("/");
  return parts.length > 1 ? parts[1] : model.id;
}
