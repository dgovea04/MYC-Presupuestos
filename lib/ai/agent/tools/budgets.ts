import { z } from "zod";
import type { AgentToolDefinition } from "../types";
import { getBudgetById } from "@/lib/data/budgets";

// ─── Input schemas ───────────────────────────────────────────────────────────

const searchBudgetsInput = z.object({
  query: z.string().min(1).describe("Texto para buscar presupuestos por nombre"),
  projectId: z.string().optional().describe("Filtrar por proyecto"),
});

const calculateBudgetInput = z.object({
  budgetId: z.string().min(1).describe("ID del presupuesto a calcular"),
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

// ─── All budget tools ────────────────────────────────────────────────────────

export const budgetTools: AgentToolDefinition[] = [
  searchBudgetsTool,
  calculateBudgetTool,
];
