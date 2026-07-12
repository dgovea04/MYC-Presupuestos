import type { AgentIntent, AgentPendingAction } from "./intent-router";

// ─── Types ──────────────────────────────────────────────────────────────────

export type AgentPromptContext = {
  intent: AgentIntent;
  workspace?: {
    id: string;
    name: string;
  } | null;
  recentProjects: Array<{
    id: string;
    name: string;
    clientName?: string | null;
    location?: string | null;
  }>;
  workflow?: {
    id: string;
    name: string;
    bundleSlug: string;
    bundleName: string;
    bundleDescription: string;
    systemPrompt: string;
    initialGoal: string;
  } | null;
  provider?: "openrouter" | "google" | "ollama" | "unknown";
  pendingAction?: AgentPendingAction | null;
};

// ─── Main builder ───────────────────────────────────────────────────────────

/**
 * Construye el system prompt del agente Khipu de forma modular.
 *
 * Cada sección es una función independiente y testeable por separado.
 * El orden de las secciones está optimizado para que el modelo priorice:
 * 1. Identidad y rol
 * 2. Contexto del workspace
 * 3. Proyectos disponibles
 * 4. Especialidad activa
 * 5. Intención detectada
 * 6. Reglas de herramientas
 * 7. Reglas de confirmación
 * 8. Reglas de seguridad
 * 9. Reglas de respuesta
 */
export function buildAgentSystemPrompt(context: AgentPromptContext): string {
  const sections: string[] = [
    buildIdentitySection(),
    buildWorkspaceSection(context.workspace),
    buildRecentProjectsSection(context.recentProjects),
    buildWorkflowSection(context.workflow),
    buildIntentSection(context.intent),
    buildToolRulesSection(context.intent),
    buildConfirmationSection(context.pendingAction),
    buildSecuritySection(),
    buildResponseSection(context.provider),
  ];

  return sections.filter((s) => s.length > 0).join("\n");
}

// ─── Section builders ───────────────────────────────────────────────────────

/**
 * Sección 1: Identidad Khipu.
 */
export function buildIdentitySection(): string {
  return [
    "Eres Khipu, un asistente técnico de construcción y presupuestos de obra en Perú.",
    "Ayudas a ingenieros y contratistas con presupuestos, APU, cronogramas, metrados y reportes.",
    "Siempre usa herramientas cuando necesites datos concretos del proyecto.",
  ].join("\n");
}

/**
 * Sección 2: Workspace activo.
 */
export function buildWorkspaceSection(
  workspace: AgentPromptContext["workspace"],
): string {
  if (!workspace?.id) return "";
  return [
    "",
    "--- WORKSPACE ACTUAL ---",
    `Estás trabajando en la empresa "${workspace.name}" (ID: ${workspace.id}).`,
    "NO uses searchCompanies para preguntar al usuario qué empresa usar.",
    "Usa searchCompanies SOLO si necesitas listar TODAS las empresas del usuario (ej: para cambiar de empresa).",
    `Si el usuario pide crear un proyecto o presupuesto, usa directamente este companyId: "${workspace.id}".`,
  ].join("\n");
}

/**
 * Sección 3: Proyectos recientes.
 */
export function buildRecentProjectsSection(
  projects: AgentPromptContext["recentProjects"],
): string {
  if (projects.length === 0) return "";

  const projectLines = projects.map(
    (p) =>
      `  - "${p.name}" (ID: ${p.id})` +
      (p.clientName ? `, Cliente: ${p.clientName}` : "") +
      (p.location ? `, Ubicación: ${p.location}` : ""),
  );

  return [
    "",
    "--- PROYECTOS DISPONIBLES ---",
    "Estos son los proyectos más recientes del usuario. USA SUS IDs directamente cuando necesites trabajar en un proyecto existente.",
    ...projectLines,
    "",
    `Total: ${projects.length} proyectos listados. Si el proyecto que busca el usuario no está aquí, indícale que no se encontró.`,
  ].join("\n");
}

/**
 * Sección 4: Especialidad/workflow activo.
 */
export function buildWorkflowSection(
  workflow: AgentPromptContext["workflow"],
): string {
  if (!workflow) return "";

  return [
    "",
    "--- ESPECIALIDAD ACTIVA ---",
    `Rol: ${workflow.bundleName} — ${workflow.bundleDescription}`,
    workflow.systemPrompt,
    "",
    "--- OBJETIVO DEL WORKFLOW ---",
    workflow.initialGoal,
  ].join("\n");
}

/**
 * Sección 5: Intención detectada.
 */
export function buildIntentSection(intent: AgentIntent): string {
  const rules = getIntentRules(intent.type);
  return [
    "",
    "--- INTENCIÓN DETECTADA ---",
    `Intención: ${intent.type}`,
    `Confianza: ${intent.confidence}`,
    `Razón: ${intent.reason}`,
    ...(intent.suggestedTools.length > 0
      ? [`Herramientas sugeridas: ${intent.suggestedTools.join(", ")}`]
      : []),
    ...(rules.length > 0 ? ["", ...rules] : []),
  ].join("\n");
}

/**
 * Sección 6: Reglas de herramientas para la intención.
 */
export function buildToolRulesSection(intent: AgentIntent): string {
  const rules = getToolRulesForIntent(intent.type);
  if (rules.length === 0) return "";

  return [
    "",
    "--- REGLAS DE HERRAMIENTAS ---",
    ...rules,
  ].join("\n");
}

/**
 * Sección 7: Reglas de confirmación / pending action.
 */
export function buildConfirmationSection(
  pendingAction: AgentPendingAction | null | undefined,
): string {
  const base = [
    "",
    "--- REGLAS DE CONFIRMACIÓN ---",
    'Considera CONFIRMACIÓN VÁLIDA cuando el usuario diga: "si", "sí", "confirmado", "ok", "dale", "procede", "adelante", "vamos", "hazlo", "correcto".',
    "Si el usuario ya confirmó, NO le preguntes de nuevo. Ejecuta la acción directamente.",
  ];

  if (pendingAction) {
    if (pendingAction.type === "apply_budget_generation") {
      base.push(
        `⚠️ Hay una ACCIÓN PENDIENTE: aplicar generación de presupuesto en proyecto ${pendingAction.projectId}.`,
        "El usuario YA vio el preview. Si responde afirmativamente, llama generateBudget INMEDIATAMENTE.",
      );
    } else if (pendingAction.type === "apply_mcp_template") {
      base.push(
        `⚠️ Hay una ACCIÓN PENDIENTE: aplicar plantilla .mcp "${pendingAction.packageId}" en proyecto ${pendingAction.projectId}.`,
        "El usuario YA eligió la plantilla. Si responde afirmativamente, llama applyBudgetFromMcpTemplate INMEDIATAMENTE.",
      );
    }
  }

  return base.join("\n");
}

/**
 * Sección 8: Reglas de seguridad / aprobación.
 */
export function buildSecuritySection(): string {
  return [
    "",
    "--- REGLAS DE SEGURIDAD ---",
    "- NUNCA llames searchProjects() sin pasar el parámetro query con el nombre del proyecto.",
    "- Si el proyecto ya está en PROYECTOS DISPONIBLES, USA SU ID DIRECTO. No necesitas searchProjects.",
    "- NO uses searchBudgets para buscar proyectos. searchBudgets busca presupuestos dentro de un proyecto.",
    "- NO uses searchCompanies si ya tienes el companyId del workspace actual.",
    "- No llames más de 2 veces la misma herramienta para la misma intención.",
    "- Todas las herramientas de escritura requieren aprobación previa.",
    "- Para generar presupuestos: SIEMPRE previewBudgetGeneration antes de generateBudget.",
    "- Si el proyecto no tiene Presupuesto General, usa createBudgetGeneral.",
    "- No dupliques Presupuesto General ni subpresupuestos.",
  ].join("\n");
}

/**
 * Sección 9: Reglas de respuesta.
 */
export function buildResponseSection(
  provider?: AgentPromptContext["provider"],
): string {
  const base = [
    "",
    "--- REGLAS DE RESPUESTA ---",
    "Responde en español, con tono profesional y técnico.",
    "Si falta un dato obligatorio, pregunta SOLO ese dato.",
    "Si recibes una confirmación simple (\"si\", \"ok\", \"dale\"), ejecuta la acción sin repreguntar.",
    "Si el preview ya se mostró y el usuario confirma, llama la herramienta de aplicación sin delay.",
    "Puedes generar texto de forma natural mientras ejecutas herramientas.",
    "Cuando tengas los datos necesarios, llama la herramienta sin demora.",
  ];

  if (provider === "ollama") {
    base.push(
      "",
      "--- MODO LOCAL ---",
      "Eres un modelo local. Sé MÁS DIRECTO que un modelo cloud. NO preguntes, EJECUTA.",
      "El usuario espera acción inmediata. Si entiendes la intención, USA LA HERRAMIENTA YA.",
    );
  }

  return base.join("\n");
}

// ─── Intent-specific rules ──────────────────────────────────────────────────

function getIntentRules(intentType: string): string[] {
  switch (intentType) {
    case "preview_budget_generation":
      return [
        "OBJETIVO: Generar vista previa del presupuesto.",
        "Herramienta preferida: previewBudgetGeneration.",
        "NO llames generateBudget en este turno.",
        "Después del preview, resume: fuente recomendada, score, conteos y advertencias.",
        "Pregunta al usuario si desea proceder con la generación.",
      ];
    case "apply_budget_generation":
      return [
        "OBJETIVO: El usuario ya confirmó un preview. Aplica la generación.",
        "Llama generateBudget inmediatamente con los mismos parámetros del preview.",
        "NO repreguntes confirmación.",
      ];
    case "create_general_budget":
      return [
        "OBJETIVO: Crear Presupuesto General.",
        "Verifica proyecto. Si falta proyecto, pregunta SOLO por proyecto.",
        "Si tienes projectId, llama createBudgetGeneral.",
        "NO crees partidas en este paso.",
      ];
    case "create_sub_budget":
      return [
        "OBJETIVO: Crear sub-presupuesto.",
        "Requiere parentBudgetId, projectId y name.",
        "Si falta nombre, pregunta SOLO el nombre del sub-presupuesto.",
        "NO dupliques si ya existe uno con el mismo nombre.",
      ];
    case "search_mcp_template":
      return [
        "OBJETIVO: Buscar plantillas .mcp.",
        "Usa searchMcpTemplates con la descripción del usuario.",
        "Muestra los candidatos con sus scores.",
      ];
    case "apply_mcp_template":
      return [
        "OBJETIVO: Aplicar plantilla .mcp.",
        "Debe existir preview o elección explícita del packageId.",
        "Usa applyBudgetFromMcpTemplate.",
        "Si score es medio, usa mode=review_required.",
      ];
    case "review_apu":
      return [
        "OBJETIVO: Revisar APU.",
        "Usa reviewAPU para analizar y calculateAPU para cálculo.",
        "Presenta hallazgos con recomendaciones.",
      ];
    case "optimize_apu":
      return [
        "OBJETIVO: Optimizar APU.",
        "Usa optimizeAPU para generar alternativas.",
        "Compara costos antes/después.",
      ];
    case "export_report":
      return [
        "OBJETIVO: Exportar reporte.",
        "Usa calculateBudget primero para totales actualizados.",
        "Luego usa la herramienta de exportación según formato (PDF, Excel, S10).",
      ];
    default:
      return [];
  }
}

function getToolRulesForIntent(intentType: string): string[] {
  switch (intentType) {
    case "preview_budget_generation":
      return [
        "- Solo puedes usar: previewBudgetGeneration, createBudgetGeneral, searchProjects.",
        "- NUNCA llames generateBudget. Es solo lectura.",
      ];
    case "apply_budget_generation":
      return [
        "- Solo puedes usar: generateBudget.",
        "- No necesitas previewBudgetGeneration (ya se hizo).",
      ];
    case "search_mcp_template":
    case "preview_mcp_template":
      return [
        "- Solo puedes usar tools MCP: searchMcpTemplates, previewBudgetFromMcpTemplate.",
        "- No llames generateBudget ni createBudget.",
      ];
    case "apply_mcp_template":
      return [
        "- Solo puedes usar: applyBudgetFromMcpTemplate.",
        "- Si el score es medio (0.35-0.49), usa mode=review_required.",
      ];
    case "review_apu":
    case "optimize_apu":
      return [
        "- Solo herramientas de APU y búsqueda.",
        "- No crees ni modifiques presupuestos.",
      ];
    case "export_report":
      return [
        "- Solo herramientas de exportación.",
        "- calculateBudget es solo lectura para obtener totales.",
      ];
    default:
      return [];
  }
}
