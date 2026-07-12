import type { AgentIntentType, AgentIntent } from "./intent-router";

// ─── Intent → Tool allowlist ────────────────────────────────────────────────

/**
 * Mapa que define qué herramientas están permitidas para cada intención.
 * Si una intención no está en el mapa, se permiten todas las herramientas
 * (comportamiento legacy sin filtro).
 *
 * Herramientas de lectura universales (searchProjects, searchBudgets) se
 * agregan automáticamente si están disponibles en el bundle.
 */
const INTENT_TOOL_ALLOWLIST: Record<AgentIntentType, string[]> = {
  general_chat: [],
  create_project: ["createProject"],
  select_existing_project: ["searchProjects"],
  create_general_budget: ["createBudgetGeneral", "searchProjects"],
  create_sub_budget: ["createSubBudget", "searchBudgets"],
  preview_budget_generation: [
    "previewBudgetGeneration",
    "createBudgetGeneral",
    "searchProjects",
  ],
  apply_budget_generation: ["generateBudget"],
  search_mcp_template: ["searchMcpTemplates"],
  preview_mcp_template: ["previewBudgetFromMcpTemplate"],
  apply_mcp_template: ["applyBudgetFromMcpTemplate"],
  review_apu: ["reviewAPU", "calculateAPU", "searchPartidas"],
  optimize_apu: ["optimizeAPU", "reviewAPU", "calculateAPU", "searchInsumos"],
  export_report: ["calculateBudget", "exportPDF", "exportExcel", "exportS10"],
};

// ─── Universal read tools ───────────────────────────────────────────────────

const UNIVERSAL_READ_TOOLS = ["searchProjects", "searchBudgets"];

// ─── Public API ─────────────────────────────────────────────────────────────

export type GetAllowedToolsInput = {
  intent: AgentIntent;
  workflowId?: string;
  /** Herramientas disponibles en el bundle actual. */
  bundleToolNames: string[];
  /** Todas las herramientas registradas (para intents sin allowlist). */
  allToolNames: string[];
};

/**
 * Filtra las herramientas disponibles según la intención detectada.
 *
 * Reglas:
 * - Si la intención es `general_chat` → no se permiten herramientas (solo chat).
 * - Si la intención tiene allowlist → solo las herramientas de esa lista.
 * - Si la intención no tiene allowlist → todas las herramientas (legacy).
 * - Herramientas de lectura universales (searchProjects, searchBudgets) se agregan
 *   automáticamente si están en el bundle.
 *
 * @returns Lista de nombres de herramientas permitidas.
 */
export function getAllowedToolsForIntent(input: GetAllowedToolsInput): string[] {
  const { intent, bundleToolNames } = input;

  // Si la intención es general_chat, no permitir herramientas
  if (intent.type === "general_chat") {
    return [];
  }

  // Si la intención no tiene allowlist definido, retornar todas
  const allowList = INTENT_TOOL_ALLOWLIST[intent.type];
  if (!allowList) {
    return bundleToolNames;
  }

  // Si la allowlist está vacía, significa que no se permiten herramientas
  if (allowList.length === 0) {
    return [];
  }

  // Filtrar: solo herramientas en la allowlist que estén disponibles en el bundle
  const allowed = allowList.filter((tool) => bundleToolNames.includes(tool));

  // Agregar herramientas de lectura universales si están en el bundle
  for (const universal of UNIVERSAL_READ_TOOLS) {
    if (bundleToolNames.includes(universal) && !allowed.includes(universal)) {
      allowed.push(universal);
    }
  }

  return allowed;
}

/**
 * Verifica si una herramienta específica está permitida para la intención dada.
 */
export function isToolAllowedForIntent(
  toolName: string,
  intent: AgentIntent,
): boolean {
  if (intent.type === "general_chat") return false;

  const allowList = INTENT_TOOL_ALLOWLIST[intent.type];
  if (!allowList) return true; // Legacy: all allowed
  if (allowList.length === 0) return false;

  if (allowList.includes(toolName)) return true;
  if (UNIVERSAL_READ_TOOLS.includes(toolName)) return true;

  return false;
}
