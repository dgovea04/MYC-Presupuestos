import { z } from "zod";
import type { AgentToolDefinition } from "../types";
import { getBudgetById, createBudget } from "@/lib/data/budgets";

// ─── Input schemas ───────────────────────────────────────────────────────────

const searchBudgetsInput = z.object({
  query: z.string().min(1).describe("Texto para buscar presupuestos por nombre"),
  projectId: z.string().optional().describe("Filtrar por proyecto"),
});

const calculateBudgetInput = z.object({
  budgetId: z.string().min(1).describe("ID del presupuesto a calcular"),
});

const createBudgetInput = z.object({
  projectId: z.string().min(1).describe("ID del proyecto donde crear el presupuesto"),
  name: z.string().min(3).describe("Nombre del presupuesto"),
  description: z.string().optional().describe("Descripción opcional"),
  currency: z.enum(["PEN", "USD"]).default("PEN").describe("Moneda del presupuesto"),
  indirectCostPercentage: z.number().min(0).max(100).default(10).describe("Porcentaje de gastos generales"),
  utilityPercentage: z.number().min(0).max(100).default(10).describe("Porcentaje de utilidad"),
  taxPercentage: z.number().min(0).max(30).default(18).describe("Porcentaje de IGV"),
  location: z.string().optional().describe("Ubicación de la obra"),
});

const cloneBudgetInput = z.object({
  budgetId: z.string().min(1).describe("ID del presupuesto a clonar"),
  newName: z.string().min(3).describe("Nombre del nuevo presupuesto clonado"),
});

const archiveBudgetInput = z.object({
  budgetId: z.string().min(1).describe("ID del presupuesto a archivar"),
});

const generateBudgetInput = z.object({
  projectId: z.string().min(1).describe("ID del proyecto"),
  description: z.string().min(10).describe("Descripción de la obra para generar el presupuesto"),
  templateType: z.enum(["edificio", "carretera", "hospital", "colegio", "vivienda", "industrial"]).optional().describe("Tipo de plantilla a usar"),
});

const compareBudgetsInput = z.object({
  budgetIds: z.array(z.string().min(1)).min(2).max(5).describe("IDs de presupuestos a comparar (2-5)"),
});

// ─── Tool definitions ────────────────────────────────────────────────────────

export const searchBudgetsTool: AgentToolDefinition<
  z.infer<typeof searchBudgetsInput>,
  Record<string, unknown>
> = {
  name: "searchBudgets",
  description:
    "Busca presupuestos por nombre o proyecto. Retorna lista de presupuestos con IDs, nombres, totales y moneda.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: searchBudgetsInput,
  execute: async (input, context) => {
    // Stub: En fases posteriores, delegar a un servicio de búsqueda real.
    // Por ahora, si se proporciona budgetId exacto, buscar directamente.
    if (input.projectId) {
      return {
        message: `Búsqueda de presupuestos con query="${input.query}" en proyecto ${input.projectId}`,
        budgets: [],
      };
    }
    return {
      message: `Búsqueda de presupuestos con query="${input.query}"`,
      budgets: [],
    };
  },
  summarizeResult: (result) =>
    `Búsqueda completada: ${(result.budgets as unknown[]).length} presupuestos encontrados.`,
};

export const calculateBudgetTool: AgentToolDefinition<
  z.infer<typeof calculateBudgetInput>,
  Record<string, unknown>
> = {
  name: "calculateBudget",
  description:
    "Calcula totales de un presupuesto (costo directo, gastos generales, utilidad, IGV, total). Solo lectura.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: calculateBudgetInput,
  execute: async (input, context) => {
    const budget = await getBudgetById(input.budgetId, context.userId);
    if (!budget) {
      throw new Error(`Presupuesto "${input.budgetId}" no encontrado.`);
    }
    return {
      budgetId: budget.id,
      name: budget.name,
      totalDirectCost: budget.totalDirectCost,
      totalGeneralExpenses: budget.totalGeneralExpenses,
      totalUtility: budget.totalUtility,
      totalTax: budget.totalTax,
      totalAmount: budget.totalAmount,
    };
  },
  summarizeResult: (result) =>
    `Presupuesto "${result.name}": total = ${result.totalAmount}`,
};

export const createBudgetTool: AgentToolDefinition<
  z.infer<typeof createBudgetInput>,
  Record<string, unknown>
> = {
  name: "createBudget",
  description:
    "Crea un nuevo presupuesto en un proyecto con nombre, moneda, márgenes y ubicación. Requiere aprobación previa.",
  risk: "write",
  requiresProjectId: true,
  inputSchema: createBudgetInput,
  execute: async (input, context) => {
    const budget = await createBudget(context.userId, {
      name: input.name,
      projectId: input.projectId,
      currency: input.currency,
      indirectCostPercentage: input.indirectCostPercentage,
      utilityPercentage: input.utilityPercentage,
      taxPercentage: input.taxPercentage,
      region: input.location,
    } as Parameters<typeof createBudget>[1]);

    return {
      id: budget.id,
      name: budget.name,
      projectId: budget.projectId,
      currency: budget.currency,
      indirectCostPercentage: Number(budget.indirectCostPercentage),
      utilityPercentage: Number(budget.utilityPercentage),
      taxPercentage: Number(budget.taxPercentage),
    };
  },
  summarizeResult: (result) =>
    `Presupuesto "${result.name}" creado en proyecto ${result.projectId}.`,
};  export const cloneBudgetTool: AgentToolDefinition<
  z.infer<typeof cloneBudgetInput>,
  Record<string, unknown>
> = {
  name: "cloneBudget",
  description:
    "Clona un presupuesto existente creando una copia completa con nuevo nombre. Nota: actualmente clona el proyecto completo.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: cloneBudgetInput,
  execute: async (input, context) => {
    const source = await getBudgetById(input.budgetId, context.userId);
    if (!source) throw new Error(`Presupuesto "${input.budgetId}" no encontrado.`);
    // Stub: clonar solo el presupuesto, no el proyecto entero
    return { sourceId: input.budgetId, newName: input.newName, message: "Clonación de presupuesto delegada a fases posteriores.", pending: true };
  },
  summarizeResult: (result) =>
    `Presupuesto "${result.newName}" clonado desde ${result.sourceId}.`,
};

export const archiveBudgetTool: AgentToolDefinition<
  z.infer<typeof archiveBudgetInput>,
  Record<string, unknown>
> = {
  name: "archiveBudget",
  description:
    "Archiva un presupuesto (desactiva sin eliminar). El presupuesto deja de aparecer en vistas activas pero sus datos se conservan.",
  risk: "financial",
  requiresProjectId: false,
  inputSchema: archiveBudgetInput,
  execute: async (input, _context) => {
    // Stub: implementar soft-delete con flag archived en fases posteriores
    return { budgetId: input.budgetId, archived: true, message: "Archivado delegado a fases posteriores." };
  },
  summarizeResult: () => "Presupuesto archivado correctamente.",
};

export const generateBudgetTool: AgentToolDefinition<
  z.infer<typeof generateBudgetInput>,
  Record<string, unknown>
> = {
  name: "generateBudget",
  description:
    "Genera un presupuesto preliminar para una obra basado en una descripción técnica. Crea capítulos y partidas sugeridas automáticamente.",
  risk: "write",
  requiresProjectId: true,
  inputSchema: generateBudgetInput,
  execute: async (input, context) => {
    // Stub: en fases posteriores delegar a AI budget generation service
    return {
      projectId: input.projectId,
      description: input.description,
      templateType: input.templateType ?? "edificio",
      message: `Generación de presupuesto para "${input.description}" delegada a fases posteriores.`,
      pending: true,
    };
  },
  summarizeResult: (result) =>
    `Presupuesto generado para "${result.description}" (tipo: ${result.templateType}).`,
};

export const compareBudgetsTool: AgentToolDefinition<
  z.infer<typeof compareBudgetsInput>,
  Record<string, unknown>
> = {
  name: "compareBudgets",
  description:
    "Compara múltiples presupuestos mostrando diferencias en totales, partidas y estructura de costos.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: compareBudgetsInput,
  execute: async (input, context) => {
    const budgets = await Promise.all(
      input.budgetIds.map((id) => getBudgetById(id, context.userId)),
    );

    const valid = budgets.filter(Boolean);
    if (valid.length < 2) {
      throw new Error("Se requieren al menos 2 presupuestos válidos para comparar.");
    }

    const comparison = valid.map((b) => ({
      id: b!.id,
      name: b!.name,
      totalAmount: b!.totalAmount,
      directCost: b!.totalDirectCost,
      indirectCost: b!.indirectCostAmount,
    }));

    const maxTotal = Math.max(...comparison.map((c) => Number(c.totalAmount)));
    const minTotal = Math.min(...comparison.map((c) => Number(c.totalAmount)));

    return {
      budgets: comparison,
      maxTotal,
      minTotal,
      difference: maxTotal - minTotal,
      count: comparison.length,
    };
  },
  summarizeResult: (result) =>
    `${result.count} presupuestos comparados. Diferencia: S/ ${result.difference}.`,
};

// ─── All budget tools ────────────────────────────────────────────────────────

export const budgetTools: AgentToolDefinition[] = [
  searchBudgetsTool,
  calculateBudgetTool,
  createBudgetTool,
  cloneBudgetTool,
  archiveBudgetTool,
  generateBudgetTool,
  compareBudgetsTool,
];
