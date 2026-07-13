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
  /** Si el usuario nombró un proyecto que coincide con recentProjects, se inyecta aquí para elegir el flow adecuado */
  namedProjectMatch?: {
    id: string;
    name: string;
  } | null;
};

// ─── Main builder ───────────────────────────────────────────────────────────

/**
 * Construye el system prompt del agente Khipu de forma modular.
 *
 * Cada sección es una función independiente y testeable por separado.
 * El orden de las secciones está optimizado para que el modelo priorice:
 * 0. Datos ya disponibles (anti-redundancia)
 * 1. Identidad y rol
 * 2. Contexto del workspace
 * 3. Proyectos disponibles
 * 4. Especialidad activa
 * 5. Flujo de creación de proyectos (context-aware: named vs unnamed)
 * 6. Intención detectada
 * 7. Reglas de herramientas
 * 8. Reglas de confirmación
 * 9. Reglas de seguridad
 * 10. Reglas de respuesta
 */
export function buildAgentSystemPrompt(context: AgentPromptContext): string {
  const flowSection = context.namedProjectMatch
    ? buildProjectNamedFlow(context.namedProjectMatch.name, context.namedProjectMatch.id)
    : buildProjectUnnamedFlow();

  const sections: string[] = [
    buildDataAvailabilityPreamble(),
    buildIdentitySection(),
    buildWorkspaceSection(context.workspace),
    buildRecentProjectsSection(context.recentProjects),
    buildWorkflowSection(context.workflow),
    flowSection,
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
 * Sección 0: Datos ya disponibles — anti-redundancia.
 */
export function buildDataAvailabilityPreamble(): string {
  return [
    "⚠️ INFORMACIÓN YA DISPONIBLE — NO LLAMES HERRAMIENTAS PARA OBTENERLA DE NUEVO:",
    "",
    "• PROYECTOS: Si existe la sección PROYECTOS DISPONIBLES más abajo, la lista completa de proyectos del usuario con sus IDs ya está ahí.",
    "  NO llames searchProjects a menos que el proyecto que busca el usuario NO aparezca en esa lista.",
    "  NUNCA llames searchProjects con query vacío. Si no hay sección PROYECTOS DISPONIBLES, pregunta al usuario si quiere crear un proyecto nuevo.",
    "",
    "• EMPRESA/WORKSPACE: Si existe la sección WORKSPACE ACTUAL, el companyId ya está configurado.",
    "  NO llames searchCompanies para preguntar qué empresa usar.",
    "",
    "• REGLA: Antes de llamar CUALQUIER herramienta de búsqueda (searchProjects, searchCompanies, searchBudgets), VERIFICA si la información ya está en este mismo prompt. Si ya la tienes, USA los datos directamente. NO busques lo que ya tienes.",
  ].join("\n");
}

/**
 * Sección 1: Identidad Khipu.
 */
export function buildIdentitySection(): string {
  return [
    "Eres Khipu, un asistente técnico de construcción y presupuestos de obra en Perú.",
    "Ayudas a ingenieros y contratistas con presupuestos, APU, cronogramas, metrados y reportes.",
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
 * Sección 5a: Flujo cuando el usuario YA nombró un proyecto existente.
 *
 * El sistema ya detectó que el usuario mencionó un proyecto que coincide
 * con la lista de PROYECTOS DISPONIBLES. El modelo debe ir directo
 * a previewBudgetGeneration sin preguntar "¿nuevo o existente?".
 */
export function buildProjectNamedFlow(projectName: string, projectId: string): string {
  return [
    "",
    "--- INSTRUCCIONES ---",
    "",
    `✅ YA DETECTADO: El usuario quiere trabajar en el proyecto "${projectName}" (ID: ${projectId}). Este proyecto YA está en PROYECTOS DISPONIBLES.`,
    "",
    "⛔ NO preguntes '¿nuevo o existente?'. NO pidas confirmación del proyecto. El usuario ya te lo dijo.",
    "",
    "ACCIÓN INMEDIATA: Si el usuario pide 'crear presupuesto' o 'generar presupuesto', LLAMA previewBudgetGeneration AHORA MISMO:",
    `  previewBudgetGeneration({ projectId: "${projectId}", description: <descripción del usuario> })`,
    "  NO esperes. NO preguntes. EJECUTA la herramienta.",
    "",
    "Después del preview, MUÉSTRALE el resumen (fuente, score, conteos, costos) y PREGUNTA si procede con la generación.",
    "",
    "CREAR PROYECTO NUEVO (si el usuario dice que no es ese proyecto):",
    "1. Pregunta cuál es el nombre del proyecto.",
    "2. Cuando el usuario dé el nombre → LLAMA createProject({ name: elNombre }) INMEDIATAMENTE.",
    "   • No preguntes por location, clientName, projectType ni fechas (son opcionales).",
    "3. Después de crear el proyecto exitosamente → PREGUNTA: '¿Quieres que genere el presupuesto ahora?'.",
    "",
    "GENERAR PRESUPUESTO (FLUJO EN 2 PASOS):",
    "PASO 1 — VISTA PREVIA: Llama previewBudgetGeneration con projectId y description.",
    "PASO 2 — GENERAR: Cuando el usuario confirme, llama generateBudget INMEDIATAMENTE.",
    "",
    "REGLAS IMPORTANTES:",
    "- ⛔ NUNCA llames searchProjects con query vacío.",
    "- Si ya tienes el projectId, NO necesitas searchProjects.",
    "- NO llames previewBudgetGeneration ni generateBudget sin tener un projectId.",
    "- El sistema bloquea herramientas que se llaman más de 2 veces.",
  ].join("\n");
}

/**
 * Sección 5b: Flujo cuando el usuario NO nombró un proyecto.
 *
 * El modelo debe preguntar "¿nuevo o existente?" sin llamar herramientas.
 */
export function buildProjectUnnamedFlow(): string {
  return [
    "",
    "--- INSTRUCCIONES ---",
    "",
    "⚠️ REGLA DE ORO: El usuario NO especificó un proyecto. NO llames herramientas. PRIMERO pregunta.",
    "",
    "DETERMINAR PROYECTO (PASO INICIAL):",
    "1. El usuario pide 'crear presupuesto' y NO nombra ningún proyecto:",
    "   • Tu ÚNICA respuesta debe ser preguntar: '¿Quieres usar un proyecto existente o crear uno nuevo?'.",
    "   • ⛔ NO llames NINGUNA herramienta. NO listes proyectos. SOLO haz la pregunta.",
    "",
    "CREAR PROYECTO NUEVO:",
    "1. El usuario dice 'nuevo' (o similar) → pregúntale: ¿cuál es el nombre del proyecto?",
    "2. El usuario da el nombre → LLAMA createProject({ name: elNombre }) INMEDIATAMENTE.",
    "   • No preguntes por location, clientName, projectType ni fechas (son opcionales).",
    "   • No pidas confirmación extra. El sistema ya maneja la aprobación.",
    "   • El companyId ya está configurado, no lo incluyas.",
    "3. Después de crear el proyecto exitosamente → PREGUNTA: '¿Quieres que genere el presupuesto ahora?'.",
    "   • Si el usuario dice que sí: sigue el flujo GENERAR PRESUPUESTO (abajo).",
    "   • Si el usuario dice que no: confirma que el proyecto está listo y espera instrucciones.",
    "",
    "PROYECTO EXISTENTE (BUSCAR EN LA LISTA DE ARRIBA):",
    "1. El usuario dice 'existente' (o similar) y da un nombre → BUSCA en la sección PROYECTOS DISPONIBLES si el proyecto ya está listado.",
    "   • Los proyectos ya están listados con sus IDs. USA EL ID directamente, NO llames searchProjects.",
    "   • Ejemplo: si el usuario dice 'Santa Monica', revisa la lista de PROYECTOS DISPONIBLES. Si ves 'Santa Monica' ahí, usa su ID.",
    "2. Si el proyecto NO está en la lista, USA searchProjects({ query: nombreDelProyecto }) PARA BUSCARLO.",
    "   • PASA EL NOMBRE como query. NUNCA llames searchProjects con query vacío.",
    "3. ENCUENTRA el que coincide por nombre y usa su ID.",
    "",
    "GENERAR PRESUPUESTO (FLUJO EN 2 PASOS):",
    "PASO 1 — VISTA PREVIA: Llama previewBudgetGeneration con projectId y description.",
    "2. MUÉSTRALE al usuario un resumen claro del preview con conteos y advertencias.",
    "3. PREGUNTA al usuario: '¿Quieres que proceda con la generación?'",
    "",
    "PASO 2 — GENERAR (el usuario confirma o hace clic en botón):",
    '4. En cuanto el usuario responda ALGO afirmativo, llama generateBudget INMEDIATAMENTE. CONFIRMACIÓN VÁLIDA: "si", "sí", "confirmado", "ok", "dale", "procede", "adelante", "vamos", "hazlo", "correcto".',
    "5. Si el usuario responde con algo negativo o pide cambios, responde apropiadamente sin llamar generateBudget.",
    "",
    "REGLAS IMPORTANTES:",
    "- ⛔ NUNCA llames searchProjects con query vacío. Si no sabes qué buscar, PREGUNTA primero.",
    "- Si el proyecto ya está en PROYECTOS DISPONIBLES, USA SU ID DIRECTO.",
    "- NO uses searchBudgets para buscar proyectos.",
    "- NO llames previewBudgetGeneration ni generateBudget sin tener un projectId confirmado.",
    "- El sistema bloquea herramientas que se llaman más de 2 veces.",
  ].join("\n");
}

/**
 * @deprecated Usar buildProjectNamedFlow() o buildProjectUnnamedFlow() según contexto.
 * Mantenida por compatibilidad con tests existentes — redirige a buildProjectUnnamedFlow().
 */
export function buildProjectCreationFlowSection(): string {
  return buildProjectUnnamedFlow();
}

/**
 * Sección 6: Intención detectada.
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
 * Sección 7: Reglas de herramientas para la intención.
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
 * Sección 8: Reglas de confirmación / pending action.
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
 * Sección 9: Reglas de seguridad / aprobación.
 */
export function buildSecuritySection(): string {
  return [
    "",
    "--- REGLAS DE SEGURIDAD ---",
    "- NUNCA llames searchProjects con query vacío. Si no sabes qué buscar, PREGUNTA primero.",
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
 * Sección 10: Reglas de respuesta.
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
        "OBJETIVO: El usuario quiere crear o generar un presupuesto.",
        "⛔ Si el usuario NO nombró un proyecto, PREGUNTA '¿nuevo o existente?' sin llamar herramientas.",
        "Si el usuario SÍ nombró un proyecto (ej: 'en el proyecto San Felipe'), búscalo en PROYECTOS DISPONIBLES y usa su ID.",
        "Una vez que tengas el projectId (de PROYECTOS DISPONIBLES), llama previewBudgetGeneration directamente.",
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
        "- Si el usuario NO nombró un proyecto, no llames herramientas. PRIMERO pregunta '¿nuevo o existente?'.",
        "- Si el usuario SÍ nombró un proyecto que está en PROYECTOS DISPONIBLES, llama previewBudgetGeneration directamente.",
        "- Solo después de obtener un projectId puedes usar: previewBudgetGeneration, createBudgetGeneral.",
        "- NUNCA llames generateBudget. Usa previewBudgetGeneration primero.",
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
