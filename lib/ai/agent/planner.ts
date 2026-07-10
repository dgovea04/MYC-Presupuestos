import crypto from "crypto";
import type { AgentExecutionMode, PlannedStep } from "./types";
import type { AgentPlanner, PlannerInput } from "./contracts";
import {
  getWorkflowTemplate,
  getBundleBySlug,
} from "./workflows";

/**
 * Mapa de palabras clave → nombres de herramientas.
 * El planner busca estas palabras en el goal del usuario para seleccionar
 * las herramientas relevantes. Las herramientas se ordenan: read primero,
 * luego write/financial/export. Las write van después de las read.
 *
 * En fases futuras, este planner puede reemplazarse por uno basado en LLM
 * que genere pasos más precisos y contextuales.
 */
const KEYWORD_TOOLS: Array<{
  keywords: string[];
  toolName: string;
  title: string;
  objective: string;
  expectedOutcome: string;
  isWrite: boolean;
  approvalBoundary: boolean;
}> = [
  {
    keywords: ["buscar partida", "busca partida", "partida", "catálogo", "catalog"],
    toolName: "searchPartidas",
    title: "Buscar partidas en el catálogo",
    objective: "Buscar partidas que coincidan con la descripción del usuario.",
    expectedOutcome: "Lista de partidas coincidentes con precios y recursos.",
    isWrite: false,
    approvalBoundary: false,
  },
  {
    keywords: ["sugerir partida", "sugerencia", "recomendar partida", "partida similar"],
    toolName: "suggestPartidas",
    title: "Sugerir partidas relevantes",
    objective: "Sugerir partidas basadas en la descripción de obra del usuario.",
    expectedOutcome: "Partidas sugeridas con puntuación de relevancia.",
    isWrite: false,
    approvalBoundary: false,
  },    {
      keywords: ["agregar partida", "agrega", "añadir partida", "crear partida", "nueva partida"],
    toolName: "addPartida",
    title: "Agregar partida al catálogo",
    objective: "Crear una nueva partida con descripción, unidad y precio.",
    expectedOutcome: "Partida creada en el catálogo.",
    isWrite: true,
    approvalBoundary: true,
  },
  {
    keywords: ["calcular presupuesto", "total presupuesto", "costo presupuesto", "presupuesto"],
    toolName: "calculateBudget",
    title: "Calcular totales del presupuesto",
    objective: "Calcular costo directo, gastos generales, utilidad e IGV.",
    expectedOutcome: "Totales del presupuesto desglosados.",
    isWrite: false,
    approvalBoundary: false,
  },
  {
    keywords: ["buscar presupuesto", "lista presupuesto", "presupuestos"],
    toolName: "searchBudgets",
    title: "Buscar presupuestos",
    objective: "Buscar presupuestos por nombre o proyecto.",
    expectedOutcome: "Lista de presupuestos encontrados.",
    isWrite: false,
    approvalBoundary: false,
  },
  {
    keywords: ["apu", "análisis de precios", "precio unitario", "calcular apu"],
    toolName: "calculateAPU",
    title: "Calcular APU",
    objective: "Calcular análisis de precios unitarios con materiales, mano de obra y equipos.",
    expectedOutcome: "Costo unitario calculado con desglose de recursos.",
    isWrite: false,
    approvalBoundary: false,
  },
  {
    keywords: ["revisar apu", "revisión apu", "auditar apu"],
    toolName: "reviewAPU",
    title: "Revisar APU",
    objective: "Revisar un análisis de precios unitarios existente.",
    expectedOutcome: "Hallazgos y recomendaciones sobre el APU.",
    isWrite: false,
    approvalBoundary: false,
  },
  {
    keywords: ["insumo", "material", "buscar insumo", "recurso"],
    toolName: "searchInsumos",
    title: "Buscar insumos en el catálogo",
    objective: "Buscar materiales, mano de obra, equipos por descripción o categoría.",
    expectedOutcome: "Lista de insumos encontrados con precios.",
    isWrite: false,
    approvalBoundary: false,
  },
  {
    keywords: ["agregar insumo", "añadir insumo", "crear insumo", "nuevo insumo"],
    toolName: "addInsumo",
    title: "Agregar insumo al catálogo",
    objective: "Crear un nuevo insumo con descripción, unidad, categoría y precio.",
    expectedOutcome: "Insumo creado en el catálogo.",
    isWrite: true,
    approvalBoundary: true,
  },
  {
    keywords: ["cronograma", "programación", "schedule", "generar cronograma"],
    toolName: "createSchedule",
    title: "Generar cronograma de obra",
    objective: "Crear o regenerar el cronograma basado en rendimientos y cantidades.",
    expectedOutcome: "Cronograma con fechas de inicio, fin y distribución mensual.",
    isWrite: true,
    approvalBoundary: true,
  },
  {
    keywords: ["reporte", "exportar", "pdf", "excel", "informe"],
    toolName: "exportReport",
    title: "Exportar reporte",
    objective: "Exportar presupuesto en formato PDF o Excel.",
    expectedOutcome: "Reporte generado en el formato solicitado.",
    isWrite: false,
    approvalBoundary: true,
  },
  {
    keywords: ["capítulo", "crear capítulo", "nuevo capítulo", "título"],
    toolName: "createChapter",
    title: "Crear capítulo en presupuesto",
    objective: "Crear un nuevo capítulo (título) en la estructura del presupuesto.",
    expectedOutcome: "Capítulo creado con código y nombre.",
    isWrite: true,
    approvalBoundary: true,
  },
  {
    keywords: ["revisar metrado", "metrado", "takeoff", "revisión metrado"],
    toolName: "reviewTakeoff",
    title: "Revisar hoja de metrado",
    objective: "Revisar unidades, fórmulas, totales y consistencia del metrado.",
    expectedOutcome: "Hallazgos y recomendaciones sobre el metrado.",
    isWrite: false,
    approvalBoundary: false,
  },
];

/**
 * Agent Planner basado en reglas de palabras clave.
 *
 * Responsabilidades:
 * - Analizar el goal del usuario (texto libre)
 * - Mapear a herramientas disponibles mediante palabras clave
 * - Ordenar pasos: read primero, luego write/financial/export
 * - Marcar approval boundaries al final del plan
 * - Resolver dependencias entre pasos
 *
 * No usa LLM — es determinista y testeable.
 */
export class AgentPlannerImpl implements AgentPlanner {
  async plan(params: PlannerInput): Promise<PlannedStep[]> {
    const { mode, workflowId } = params;

    // Si se proporciona un workflowId, reemplazar el goal con la plantilla
    // y limitar las herramientas disponibles al bundle correspondiente.
    if (workflowId) {
      const template = getWorkflowTemplate(workflowId);
      if (template) {
        const bundle = getBundleBySlug(template.bundleSlug);
        if (bundle) {
          // Usar el initialGoal del template como goal
          params = {
            ...params,
            goal: template.initialGoal,
            mode: template.defaultMode,
          };
        }
      }
    }

    const { goal: resolvedGoal, availableTools: resolvedTools } = params;
    const lowerGoal = resolvedGoal.toLowerCase();

    // Encontrar herramientas que matchean las palabras clave del goal
    // Y que estén disponibles (registradas en el ToolRegistry)
    const availableSet = new Set(resolvedTools);
    const matched = KEYWORD_TOOLS.filter(
      (kt) =>
        kt.keywords.some((kw) => lowerGoal.includes(kw)) &&
        availableSet.has(kt.toolName),
    );

    if (matched.length === 0) {
      // Sin herramientas específicas: paso genérico de razonamiento
      return [
        {
          id: crypto.randomUUID(),
          title: "Analizar solicitud",
          toolName: undefined,
          objective: resolvedGoal,
          expectedOutcome:
            "Respuesta conversacional basada en el contexto del proyecto.",
          dependsOn: [],
          approvalBoundary: false,
        },
      ];
    }

    // Ordenar: read primero, write/financial/export después
    const readMatches = matched.filter((m) => !m.isWrite);
    const writeMatches = matched.filter((m) => m.isWrite);

    // Mapear a PlannedStep con IDs generados
    const readSteps: PlannedStep[] = readMatches.map((m) => ({
      id: crypto.randomUUID(),
      title: m.title,
      toolName: m.toolName,
      objective: m.objective,
      expectedOutcome: m.expectedOutcome,
      dependsOn: [],
      approvalBoundary: false,
    }));

    const lastReadId = readSteps.length > 0 ? readSteps[readSteps.length - 1].id : undefined;

    const writeSteps: PlannedStep[] = writeMatches.map((m) => ({
      id: crypto.randomUUID(),
      title: m.title,
      toolName: m.toolName,
      objective: m.objective,
      expectedOutcome: m.expectedOutcome,
      dependsOn: lastReadId ? [lastReadId] : [],
      approvalBoundary: m.approvalBoundary,
    }));

    const steps: PlannedStep[] = [...readSteps, ...writeSteps];

    // Si el modo no es "chat", marcar el último paso como boundary de aprobación
    if (params.mode !== "chat" && steps.length > 0) {
      steps[steps.length - 1].approvalBoundary = true;
    }

    return steps;
  }
}

/**
 * Factory function.
 */
export function createPlanner(): AgentPlanner {
  return new AgentPlannerImpl();
}
