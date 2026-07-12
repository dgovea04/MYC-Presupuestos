import type { AgentToolDefinition, AgentExecutionMode } from "./types";

// ─── Specialist Bundle ───────────────────────────────────────────────────────

/**
 * Una especialidad agrupa herramientas, un prompt de sistema adicional
 * y metadatos de presentación.
 */
export type SpecialistBundle = {
  /** Slug único (ej: "budget-agent", "apu-agent"). */
  slug: string;
  /** Nombre legible para la UI. */
  name: string;
  /** Descripción del propósito de la especialidad. */
  description: string;
  /** Icono emoji o clase CSS para la UI. */
  icon: string;
  /** Herramientas que pertenecen a esta especialidad. */
  toolNames: string[];
  /** Prompt adicional inyectado en el system prompt cuando se usa esta especialidad. */
  systemPrompt: string;
};

// ─── Specialist Bundle Definitions ───────────────────────────────────────────

/**
 * Bundles de agentes especialistas del PRD V2.G.
 *
 * No son procesos paralelos; son configuraciones de herramientas, prompts
 * y constraints sobre el mismo orchestrator.
 *
 * Reference: PRD V2.G — docs/superpowers/plans/2026-07-09-khipu-agent-platform-v2-vercel-sdk.md
 */
export const SPECIALIST_BUNDLES: SpecialistBundle[] = [
  {
    slug: "khipu-agent",
    name: "Khipu General",
    description: "Agente generalista con acceso a todas las herramientas de la plataforma.",
    icon: "🤖",
    toolNames: [
      // Proyectos
      "searchCompanies", "createProject",
      // Presupuestos
      "searchBudgets", "calculateBudget", "createBudget", "createBudgetGeneral",
      "createSubBudget", "cloneBudget",
      "archiveBudget", "generateBudget", "compareBudgets",
      // Preview y MCP
      "previewBudgetGeneration", "searchMcpTemplates",
      "previewBudgetFromMcpTemplate", "applyBudgetFromMcpTemplate",
      // Capítulos
      "createChapter", "moveChapter", "deleteChapter",
      // Partidas
      "searchPartidas", "addPartida", "duplicatePartida",
      "reorderPartidas", "removePartida", "suggestPartidas",
      // APU
      "reviewAPU", "calculateAPU", "createAPU", "updateAPU",
      "generateAPU", "optimizeAPU",
      // Insumos
      "searchInsumos", "addInsumo", "replaceInsumo", "updatePrecio",
      // Cronograma
      "createSchedule", "updateTask", "linkPredecessor",
      "moveTask", "calculateCriticalPath",
      // Metrados
      "reviewTakeoff", "createTakeoff", "importTakeoff",
      // Reportes
      "exportReport", "exportPDF", "exportExcel", "exportS10", "dashboard",
    ],
    systemPrompt: [
      "Eres Khipu, el asistente técnico de obra de MC Presupuestos.",
      "Tienes acceso a todas las herramientas de la plataforma: presupuestos, partidas,",
      "APU, insumos, cronogramas, metrados, reportes y plantillas MCP.",
      "Ayuda al usuario a cumplir su objetivo usando las herramientas adecuadas.",
      "Para operaciones de escritura, primero consulta, luego ejecuta.",
      "Para generar presupuestos, SIEMPRE haz previewBudgetGeneration antes de generateBudget.",
    ].join(" "),
  },
  {
    slug: "budget-agent",
    name: "Presupuestos",
    description: "Especialista en creación, gestión y análisis de presupuestos de obra.",
    icon: "💰",
    toolNames: [
      "searchCompanies", "createProject",
      "searchBudgets", "calculateBudget", "createBudget", "createBudgetGeneral",
      "createSubBudget", "cloneBudget",
      "archiveBudget", "generateBudget", "compareBudgets",
      // Preview y MCP
      "previewBudgetGeneration", "searchMcpTemplates",
      "previewBudgetFromMcpTemplate", "applyBudgetFromMcpTemplate",
      // Capítulos
      "createChapter", "moveChapter", "deleteChapter",
      // Partidas
      "searchPartidas", "addPartida", "duplicatePartida",
      "reorderPartidas", "removePartida", "suggestPartidas",
      // Insumos
      "searchInsumos", "addInsumo", "replaceInsumo", "updatePrecio",
      "exportPDF", "exportExcel",
    ],
    systemPrompt: [
      "Eres un especialista en presupuestos de construcción.",
      "Puedes crear, clonar, archivar y comparar presupuestos.",
      "También gestionas capítulos, partidas e insumos del catálogo.",
      "",
      "FLUJO PARA CREAR UN PRESUPUESTO:",
      "1. PRIMERO, pregunta al usuario: ¿Quieres crear el presupuesto en un proyecto que ya existe o crear un proyecto nuevo desde cero?",
      "2. Si elige PROYECTO EXISTENTE: usa searchBudgets/listar los proyectos, luego createBudget en el proyecto elegido.",
      "3. Si elige PROYECTO NUEVO: pide SOLO el nombre del proyecto (obligatorio). La ubicación es opcional. Luego usa createProject con el companyId del workspace actual.",
      "",
      "FLUJO PARA GENERAR PRESUPUESTO DESDE DESCRIPCIÓN:",
      "1. SIEMPRE haz previewBudgetGeneration primero. NUNCA llames generateBudget sin preview previo.",
      "2. Si hay plantilla .mcp con score >= 0.50, recomiéndala como fuente preferente.",
      "3. Si hay .mcp con score 0.35-0.49, muéstrala pero pide confirmación explícita.",
      "4. Si no hay .mcp, usa catálogo como fallback.",
      "5. Después del preview, espera confirmación del usuario antes de generateBudget.",
      "",
      "REGLAS IMPORTANTES:",
      "- NUNCA dupliques Presupuesto General ni subpresupuestos.",
      "- createProject SOLO requiere 2 campos: companyId y name. NO pidas clientName, projectType, startDate, endDate, status ni workCalendarId a menos que el usuario los mencione.",
      "- Si el usuario solo da el nombre del proyecto, crea el proyecto inmediatamente sin pedir más datos.",
      "- NO preguntes por la empresa: ya tienes el companyId en el contexto del workspace.",
      "- Usa calculateBudget para mostrar totales después de cada cambio.",
      "- Si el proyecto no tiene Presupuesto General, usa createBudgetGeneral antes de generateBudget.",
    ].join("\n"),
  },
  {
    slug: "apu-agent",
    name: "APU",
    description: "Especialista en análisis de precios unitarios, costos y optimización de recursos.",
    icon: "📊",
    toolNames: [
      "reviewAPU", "calculateAPU", "createAPU", "updateAPU",
      "generateAPU", "optimizeAPU",
      "searchPartidas", "suggestPartidas",
      "searchInsumos",
      "calculateBudget",
    ],
    systemPrompt: [
      "Eres un especialista en análisis de precios unitarios (APU).",
      "Puedes calcular, revisar, crear, actualizar y optimizar APUs.",
      "Desglosa siempre el costo en materiales, mano de obra y equipos.",
      "Usa searchPartidas y searchInsumos para consultar el catálogo antes de crear.",
      "calculateAPU es de solo lectura; no modifica datos.",
    ].join(" "),
  },
  {
    slug: "planning-agent",
    name: "Cronograma",
    description: "Especialista en planificación de obra, cronogramas y metrados.",
    icon: "📅",
    toolNames: [
      "createSchedule", "updateTask", "linkPredecessor",
      "moveTask", "calculateCriticalPath",
      "reviewTakeoff", "createTakeoff", "importTakeoff",
      "calculateBudget",
    ],
    systemPrompt: [
      "Eres un especialista en planificación y cronogramas de construcción.",
      "Puedes crear cronogramas, actualizar tareas, establecer dependencias y calcular ruta crítica.",
      "También gestionas hojas de metrado.",
      "calculateCriticalPath es de solo lectura; usa updateTask y linkPredecessor para modificar.",
    ].join(" "),
  },
  {
    slug: "review-agent",
    name: "Revisión",
    description: "Especialista en revisión de calidad: APUs, metrados y consistencia de costos.",
    icon: "🔍",
    toolNames: [
      "reviewAPU", "reviewTakeoff", "compareBudgets",
      "searchPartidas", "searchBudgets", "searchInsumos",
      "calculateBudget", "calculateAPU",
    ],
    systemPrompt: [
      "Eres un especialista en revisión de calidad de presupuestos.",
      "Puedes revisar APUs, metrados y comparar presupuestos.",
      "Todas tus herramientas son de solo lectura.",
      "Presenta hallazgos claros con recomendaciones accionables.",
    ].join(" "),
  },
  {
    slug: "reporting-agent",
    name: "Reportes",
    description: "Especialista en exportación de reportes: PDF, Excel, S10 y dashboard.",
    icon: "📄",
    toolNames: [
      "exportPDF", "exportExcel", "exportS10", "exportReport", "dashboard",
      "calculateBudget",
    ],
    systemPrompt: [
      "Eres un especialista en generación de reportes y exportaciones.",
      "Puedes exportar presupuestos a PDF, Excel y formato S10.",
      "También generas dashboards de proyecto.",
      "calculateBudget es de solo lectura; úsalo para obtener totales actualizados antes de exportar.",
    ].join(" "),
  },
];

// ─── Workflow Template ───────────────────────────────────────────────────────

/**
 * Plantilla de workflow reutilizable que acelera casos de uso frecuentes.
 * Cada template asocia un bundle especialista con un goal predefinido.
 */
export type WorkflowTemplate = {
  /** Slug único del template (ej: "crear-presupuesto-base"). */
  slug: string;
  /** Nombre legible. */
  name: string;
  /** Descripción corta. */
  description: string;
  /** Slug del specialist bundle asociado. */
  bundleSlug: string;
  /** Goal inicial que se envía al planner. */
  initialGoal: string;
  /** Modo de ejecución recomendado. */
  defaultMode: AgentExecutionMode;
};

// ─── Workflow Template Definitions ───────────────────────────────────────────

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    slug: "crear-presupuesto-base",
    name: "Crear presupuesto base",
    description: "Crea un proyecto con su presupuesto base: capítulos, partidas y APU desde una descripción de obra.",
    bundleSlug: "budget-agent",
    initialGoal: "El usuario quiere crear un presupuesto de obra. Si el usuario no ha especificado si es proyecto nuevo o existente, pregunta primero: ¿Quieres crear el presupuesto en un proyecto existente o crear un proyecto nuevo? Si es proyecto nuevo, pide SOLO el nombre (obligatorio, la ubicación es opcional) y usa createProject con el companyId del workspace. NO pidas clientName, projectType, startDate, endDate ni status. Si es proyecto existente, busca los proyectos del usuario y crea el presupuesto en el proyecto seleccionado.",
    defaultMode: "goal",
  },
  {
    slug: "revisar-apu-proyecto",
    name: "Revisar APU del proyecto",
    description: "Analiza los análisis de precios unitarios del presupuesto activo, detecta inconsistencias y sugiere mejoras.",
    bundleSlug: "apu-agent",
    initialGoal: "Revisar los APU del presupuesto actual usando reviewAPU y calculateAPU. Analizar rendimientos, costos de insumos y verificar que los precios unitarios sean consistentes con el mercado. Si encuentras partidas sin APU o con costos sospechosos, muéstralos al usuario con recomendaciones.",
    defaultMode: "goal",
  },
  {
    slug: "generar-cronograma",
    name: "Generar cronograma de obra",
    description: "Genera un cronograma completo con ruta crítica, dependencias y fechas estimadas basado en las partidas del presupuesto.",
    bundleSlug: "planning-agent",
    initialGoal: "Generar un cronograma de obra para el presupuesto actual usando createSchedule con una fecha de inicio base. Si hay tareas sin programar, usa updateTask para ajustar duraciones y linkPredecessor para establecer dependencias entre partidas. Finalmente, usa calculateCriticalPath para calcular la ruta crítica.",
    defaultMode: "goal",
  },
  {
    slug: "exportar-reportes",
    name: "Exportar reportes del proyecto",
    description: "Exporta el presupuesto en PDF y Excel con todas las partidas, APU, cronograma y fórmula polinómica.",
    bundleSlug: "reporting-agent",
    initialGoal: "Exportar el presupuesto actual. Primero usa calculateBudget para obtener los totales actualizados, luego usa exportPDF y exportExcel para generar los archivos. Incluir todas las partidas con sus APU, el cronograma y la fórmula polinómica si está configurada.",
    defaultMode: "goal",
  },
  {
    slug: "comparar-presupuestos",
    name: "Comparar presupuestos",
    description: "Compara múltiples presupuestos mostrando diferencias en totales, partidas y estructura de costos.",
    bundleSlug: "review-agent",
    initialGoal: "Comparar 2 o más presupuestos activos usando compareBudgets. Pregunta al usuario qué presupuestos quiere comparar, ejecuta compareBudgets con los IDs y presenta las diferencias en costos directos, gastos generales y estructura de partidas de forma clara.",
    defaultMode: "goal",
  },
  {
    slug: "optimizar-apu",
    name: "Optimizar APU",
    description: "Analiza APUs existentes y sugiere optimizaciones de costos.",
    bundleSlug: "apu-agent",
    initialGoal: "Revisar los APUs del presupuesto activo usando reviewAPU para detectar oportunidades de optimización. Luego usa optimizeAPU para generar alternativas de insumos o ajustes de rendimiento que reduzcan costos sin sacrificar calidad. Presenta las sugerencias al usuario con el impacto estimado en costo.",
    defaultMode: "goal",
  },
  {
    slug: "crear-proyecto-desde-cero",
    name: "Crear proyecto desde cero",
    description: "Crea un proyecto completo con Presupuesto General y sub-presupuestos automáticos, sin agregar partidas.",
    bundleSlug: "budget-agent",
    initialGoal: "Crear un proyecto de construcción desde cero. Si ya conoces el companyId del workspace actual, úsalo directamente con createProject. SOLO pide el nombre del proyecto (obligatorio). NO pidas clientName, projectType, startDate, endDate, status ni workCalendarId. Si no conoces el companyId, usa searchCompanies. El objetivo es solo crear el proyecto y su estructura base, sin agregar capítulos, partidas ni APUs adicionales.",
    defaultMode: "goal",
  },
  {
    slug: "asistente-general",
    name: "Asistente general",
    description: "Asistente técnico completo: crea proyectos, gestiona presupuestos, partidas, APU, insumos, cronogramas, metrados y reportes.",
    bundleSlug: "khipu-agent",
    initialGoal: "Ayuda general con la plataforma. Si ya conoces el companyId del workspace actual, puedes crear proyectos directamente con createProject. Si no, usa searchCompanies. También puedes gestionar presupuestos, partidas, APU, insumos, cronogramas, metrados o reportes del proyecto actual.",
    defaultMode: "chat",
  },
];

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Obtiene un specialist bundle por su slug.
 */
export function getBundleBySlug(slug: string): SpecialistBundle | undefined {
  return SPECIALIST_BUNDLES.find((b) => b.slug === slug);
}

/**
 * Obtiene un workflow template por su slug.
 */
export function getWorkflowTemplate(slug: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.slug === slug);
}

/**
 * Filtra herramientas disponibles según las herramientas de un bundle.
 */
export function getToolsForBundle(
  bundleSlug: string,
  allTools: AgentToolDefinition[],
): AgentToolDefinition[] {
  const bundle = getBundleBySlug(bundleSlug);
  if (!bundle) return [];
  const bundleToolSet = new Set(bundle.toolNames);
  return allTools.filter((t) => bundleToolSet.has(t.name));
}

/**
 * Obtiene el system prompt de sistema para un bundle.
 */
export function getBundleSystemPrompt(bundleSlug: string): string | null {
  const bundle = getBundleBySlug(bundleSlug);
  return bundle?.systemPrompt ?? null;
}
