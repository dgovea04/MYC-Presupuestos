import { detectConfirmation, type ConfirmationResult } from "./confirmation";

// ─── Types ──────────────────────────────────────────────────────────────────

export type AgentIntentType =
  | "general_chat"
  | "create_project"
  | "select_existing_project"
  | "create_general_budget"
  | "create_sub_budget"
  | "preview_budget_generation"
  | "apply_budget_generation"
  | "search_mcp_template"
  | "preview_mcp_template"
  | "apply_mcp_template"
  | "review_apu"
  | "optimize_apu"
  | "export_report";

export type AgentIntentConfidence = "high" | "medium" | "low";

export type AgentIntentRequiredField = {
  field:
    | "projectId"
    | "projectName"
    | "budgetId"
    | "parentBudgetId"
    | "subBudgetName"
    | "description"
    | "mcpPackageId"
    | "reportFormat";
  question: string;
};

export type AgentIntent = {
  type: AgentIntentType;
  confidence: AgentIntentConfidence;
  reason: string;
  requiredFields: AgentIntentRequiredField[];
  extracted: {
    projectId?: string;
    projectName?: string;
    budgetId?: string;
    parentBudgetId?: string;
    subBudgetName?: string;
    description?: string;
    projectType?: string;
    templateSource?: "auto" | "mcp" | "project" | "catalog";
    mcpPackageId?: string;
    reportFormat?: "pdf" | "excel" | "s10";
  };
  suggestedTools: string[];
};

// ─── Pending Action ─────────────────────────────────────────────────────────

export type AgentPendingAction =
  | {
      type: "apply_budget_generation";
      projectId: string;
      description: string;
      templateSource: "auto" | "mcp" | "project" | "catalog";
      mcpPackageId?: string;
      previewId?: string;
    }
  | {
      type: "apply_mcp_template";
      projectId: string;
      packageId: string;
      description: string;
      mode: "auto" | "review_required";
      previewId?: string;
    };

// ─── Intent detection input ─────────────────────────────────────────────────

export type DetectAgentIntentInput = {
  message: string;
  messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  mode?: "chat" | "goal" | "workflow";
  workflowId?: string;
  projectId?: string;
  workspaceId?: string;
  pendingAction?: AgentPendingAction | null;
};

// ─── Keyword-to-intent mapping ──────────────────────────────────────────────

type IntentRule = {
  intent: AgentIntentType;
  keywords: string[];
  minConfidence: AgentIntentConfidence;
};

const INTENT_RULES: IntentRule[] = [
  {
    intent: "export_report",
    keywords: ["exportar", "reporte", "pdf", "excel", "s10", "informe", "descargar"],
    minConfidence: "medium",
  },
  {
    intent: "apply_mcp_template",
    keywords: ["aplicar plantilla", "aplicar mcp", "usa la plantilla", "usar plantilla mcp"],
    minConfidence: "medium",
  },
  {
    intent: "preview_mcp_template",
    keywords: ["preview mcp", "vista previa mcp", "ver plantilla", "mostrar plantilla"],
    minConfidence: "medium",
  },
  {
    intent: "search_mcp_template",
    keywords: ["mcp", ".mcp", "plantilla mcp", "buscar plantilla", "buscar mcp"],
    minConfidence: "high",
  },
  {
    intent: "create_sub_budget",
    keywords: ["subpresupuesto", "sub presupuesto", "crear especialidad", "nuevo sub"],
    minConfidence: "medium",
  },
  {
    intent: "create_general_budget",
    keywords: ["presupuesto general", "crear presupuesto general"],
    minConfidence: "medium",
  },
  {
    intent: "preview_budget_generation",
    keywords: [
      "vista previa de presupuesto",
      "preview de presupuesto",
      "previsualizar presupuesto",
      "generar presupuesto",
      "crear presupuesto con partidas",
      "presupuesto automatico",
      "presupuesto para",
      "crea un presupuesto",
      "crear un presupuesto",
      "genera un presupuesto",
      "haz un presupuesto",
      "hacer un presupuesto",
      "cotiza",
      "cotizar",
      "presupuesta",
    ],
    minConfidence: "medium",
  },
  {
    intent: "create_project",
    keywords: [
      "crear proyecto",
      "nuevo proyecto",
      "crea un proyecto",
      "crea proyecto",
      "proyecto nuevo",
    ],
    minConfidence: "medium",
  },
  {
    intent: "select_existing_project",
    keywords: [
      "proyecto existente",
      "usar proyecto",
      "trabajar en",
      "abrir proyecto",
      "seleccionar proyecto",
      "cambiar a proyecto",
    ],
    minConfidence: "medium",
  },
  {
    intent: "optimize_apu",
    keywords: ["optimizar apu", "optimiza apu", "reducir costo", "ahorrar"],
    minConfidence: "medium",
  },
  {
    intent: "review_apu",
    keywords: ["revisar apu", "revisa apu", "analizar apu", "auditar apu", "apu de"],
    minConfidence: "medium",
  },
];

// ─── Main function ──────────────────────────────────────────────────────────

/**
 * Clasifica la intención del usuario a partir de su mensaje y contexto.
 *
 * Prioridades:
 * 1. Si hay un `pendingAction` y el mensaje es confirmación → `apply_budget_generation` / `apply_mcp_template`.
 * 2. Si el mensaje matchea keywords de intención → la intención con mejor match.
 * 3. Si el mensaje es corto y no matchea → `general_chat`.
 */
export function detectAgentIntent(input: DetectAgentIntentInput): AgentIntent {
  const { message, projectId, pendingAction } = input;
  const lower = message.toLowerCase().trim();
  const confirmation = detectConfirmation(message);

  // ── 1. Pending action + confirmation ────────────────────────────────────
  if (pendingAction && confirmation.kind === "affirmative") {
    if (pendingAction.type === "apply_budget_generation") {
      return {
        type: "apply_budget_generation",
        confidence: confirmation.confidence,
        reason: "Confirmación de acción pendiente de generación de presupuesto",
        requiredFields: [],
        extracted: {
          projectId: pendingAction.projectId,
          description: pendingAction.description,
          templateSource: pendingAction.templateSource,
          mcpPackageId: pendingAction.mcpPackageId,
        },
        suggestedTools: ["generateBudget"],
      };
    }
    if (pendingAction.type === "apply_mcp_template") {
      return {
        type: "apply_mcp_template",
        confidence: confirmation.confidence,
        reason: "Confirmación de acción pendiente de aplicación MCP",
        requiredFields: [],
        extracted: {
          projectId: pendingAction.projectId,
          mcpPackageId: pendingAction.packageId,
          description: pendingAction.description,
          templateSource: "mcp",
        },
        suggestedTools: ["applyBudgetFromMcpTemplate"],
      };
    }
  }

  // ── 2. Negative/modify on pending action ────────────────────────────────
  if (pendingAction && confirmation.kind === "negative") {
    return {
      type: "general_chat",
      confidence: "medium",
      reason: "Usuario canceló la acción pendiente",
      requiredFields: [],
      extracted: { projectId },
      suggestedTools: [],
    };
  }

  if (pendingAction && confirmation.kind === "modify") {
    return {
      type: "preview_budget_generation",
      confidence: "medium",
      reason: "Usuario quiere modificar antes de aplicar",
      requiredFields: [
        { field: "description", question: "¿Qué cambios necesitas en el presupuesto?" },
      ],
      extracted: {
        projectId,
        description: confirmation.requestedChange,
      },
      suggestedTools: ["previewBudgetGeneration"],
    };
  }

  // ── 3. Keyword-based intent matching ────────────────────────────────────
  let bestMatch: { intent: AgentIntentType; confidence: AgentIntentConfidence; reason: string } | null = null;

  for (const rule of INTENT_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        // Prefer higher confidence matches
        if (!bestMatch || rule.minConfidence === "high" && bestMatch.confidence !== "high") {
          bestMatch = {
            intent: rule.intent,
            confidence: rule.minConfidence,
            reason: `Palabra clave detectada: "${kw}"`,
          };
        }
      }
    }
  }

  // ── 4. Build intent from best match ─────────────────────────────────────
  if (bestMatch) {
    return buildIntentFromType(bestMatch.intent, bestMatch.confidence, bestMatch.reason, input);
  }

  // ── 5. Default: general chat ────────────────────────────────────────────
  return {
    type: "general_chat",
    confidence: "low",
    reason: "No se detectó intención específica — conversación general",
    requiredFields: [],
    extracted: { projectId },
    suggestedTools: [],
  };
}

// ─── Intent builder helpers ─────────────────────────────────────────────────

function buildIntentFromType(
  type: AgentIntentType,
  confidence: AgentIntentConfidence,
  reason: string,
  input: DetectAgentIntentInput,
): AgentIntent {
  const { projectId } = input;
  const extracted = extractFields(input);

  switch (type) {
    case "preview_budget_generation":
      return {
        type,
        confidence,
        reason,
        requiredFields: buildPreviewRequiredFields(extracted),
        extracted,
        suggestedTools: ["previewBudgetGeneration", "createBudgetGeneral", "searchProjects"],
      };
    case "apply_budget_generation":
      return {
        type,
        confidence,
        reason,
        requiredFields: [],
        extracted,
        suggestedTools: ["generateBudget"],
      };
    case "create_general_budget":
      return {
        type,
        confidence,
        reason,
        requiredFields: projectId ? [] : [{ field: "projectId", question: "¿Para qué proyecto quieres crear el Presupuesto General?" }],
        extracted,
        suggestedTools: ["createBudgetGeneral", "searchProjects"],
      };
    case "create_sub_budget":
      return {
        type,
        confidence,
        reason,
        requiredFields: buildSubBudgetRequiredFields(extracted),
        extracted,
        suggestedTools: ["createSubBudget", "searchBudgets"],
      };
    case "search_mcp_template":
      return {
        type,
        confidence,
        reason,
        requiredFields: extracted.description ? [] : [{ field: "description", question: "¿Qué tipo de obra buscas como plantilla?" }],
        extracted,
        suggestedTools: ["searchMcpTemplates"],
      };
    case "preview_mcp_template":
      return {
        type,
        confidence,
        reason,
        requiredFields: [],
        extracted,
        suggestedTools: ["previewBudgetFromMcpTemplate"],
      };
    case "apply_mcp_template":
      return {
        type,
        confidence,
        reason,
        requiredFields: [],
        extracted,
        suggestedTools: ["applyBudgetFromMcpTemplate"],
      };
    case "review_apu":
      return {
        type,
        confidence,
        reason,
        requiredFields: [],
        extracted,
        suggestedTools: ["reviewAPU", "calculateAPU", "searchPartidas"],
      };
    case "optimize_apu":
      return {
        type,
        confidence,
        reason,
        requiredFields: [],
        extracted,
        suggestedTools: ["optimizeAPU", "reviewAPU", "calculateAPU", "searchInsumos"],
      };
    case "export_report":
      return {
        type,
        confidence,
        reason,
        requiredFields: [],
        extracted,
        suggestedTools: ["calculateBudget", "exportPDF", "exportExcel", "exportS10"],
      };
    case "create_project":
      return {
        type,
        confidence,
        reason,
        requiredFields: extracted.projectName ? [] : [{ field: "projectName", question: "¿Cómo se llama el proyecto?" }],
        extracted,
        suggestedTools: ["createProject"],
      };
    case "select_existing_project":
      return {
        type,
        confidence,
        reason,
        requiredFields: [],
        extracted,
        suggestedTools: ["searchProjects"],
      };
    default:
      return {
        type: "general_chat",
        confidence: "low",
        reason,
        requiredFields: [],
        extracted,
        suggestedTools: [],
      };
  }
}

function extractFields(input: DetectAgentIntentInput): AgentIntent["extracted"] {
  const { projectId, message } = input;
  const lower = message.toLowerCase();

  const fields: AgentIntent["extracted"] = {
    projectId,
  };

  // Extract project name
  const nameMatch = lower.match(/(?:proyecto|obra)\s+(?:llamado\s+)?["']?([a-záéíóúñA-ZÁÉÍÓÚÑ0-9\s-]{3,40})["']?(?:\s|$|,|\.)/i);
  if (nameMatch) {
    fields.projectName = nameMatch[1].trim();
  }

  // No description auto-extraction — description comes from user's message directly
  // if needed, which the LLM/model will handle via context

  // Detect MCP source
  if (lower.includes("mcp") || lower.includes(".mcp") || lower.includes("plantilla mcp")) {
    fields.templateSource = "mcp";
  } else if (lower.includes("catalogo") || lower.includes("catálogo")) {
    fields.templateSource = "catalog";
  } else if (lower.includes("plantilla") || lower.includes("proyecto similar")) {
    fields.templateSource = "project";
  } else {
    fields.templateSource = "auto";
  }

  // Detect project type
  const typeKeywords: Record<string, string> = {
    vivienda: "vivienda",
    edificio: "edificio",
    colegio: "colegio",
    hospital: "hospital",
    carretera: "carretera",
    industrial: "industrial",
  };
  for (const [key, value] of Object.entries(typeKeywords)) {
    if (lower.includes(key)) {
      fields.projectType = value;
      break;
    }
  }

  // Detect report format
  if (lower.includes("s10")) fields.reportFormat = "s10";
  else if (lower.includes("excel") || lower.includes("xlsx")) fields.reportFormat = "excel";
  else if (lower.includes("pdf")) fields.reportFormat = "pdf";

  return fields;
}

function buildPreviewRequiredFields(extracted: AgentIntent["extracted"]): AgentIntentRequiredField[] {
  const fields: AgentIntentRequiredField[] = [];
  if (!extracted.projectId) {
    fields.push({ field: "projectId", question: "¿En qué proyecto quieres generar el presupuesto?" });
  }
  if (!extracted.description) {
    fields.push({ field: "description", question: "Describe la obra: tipo, área, pisos, ubicación..." });
  }
  return fields;
}

function buildSubBudgetRequiredFields(extracted: AgentIntent["extracted"]): AgentIntentRequiredField[] {
  const fields: AgentIntentRequiredField[] = [];
  if (!extracted.parentBudgetId) {
    fields.push({ field: "parentBudgetId", question: "¿Bajo qué presupuesto padre quieres crear el sub-presupuesto?" });
  }
  if (!extracted.projectId) {
    fields.push({ field: "projectId", question: "¿En qué proyecto está el presupuesto?" });
  }
  if (!extracted.subBudgetName) {
    fields.push({ field: "subBudgetName", question: "¿Qué nombre le das al sub-presupuesto?" });
  }
  return fields;
}
