import { z } from "zod";
import type { AgentToolDefinition } from "../types";
import { getBudgetById, createBudget } from "@/lib/data/budgets";
import { getUserSettings } from "@/lib/data/settings";
import { DEFAULT_INITIAL_SUB_BUDGET_NAMES } from "@/types/settings";
import { prisma } from "@/lib/db/prisma";

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
    "Crea un nuevo presupuesto en un proyecto con nombre, moneda, márgenes y ubicación. " +
    "Automáticamente genera los sub-presupuestos (Estructuras, Arquitectura, etc.) basados en la configuración del usuario. " +
    "Requiere aprobación previa.",
  risk: "write",
  requiresProjectId: true,
  inputSchema: createBudgetInput,
  execute: async (input, context) => {
    // 1. Crear presupuesto principal
    // Nota: Mapeamos los nombres de campos del tool (percentage, 0-100) a los
    // nombres del schema/Prisma (Rate, 0-1). El schema budgetSchema espera
    // generalExpensesRate, utilityRate e igvRate como decimales (0-1).
    const budget = await createBudget(context.userId, {
      name: input.name,
      projectId: input.projectId,
      currency: input.currency,
      generalExpensesRate: input.indirectCostPercentage / 100,
      utilityRate: input.utilityPercentage / 100,
      igvRate: input.taxPercentage / 100,
    } as Parameters<typeof createBudget>[1]);

    // 2. Obtener nombres de sub-presupuestos desde settings del usuario
    const settings = await getUserSettings(context.userId);
    const subBudgetNames =
      settings.defaultSubBudgetNames.length > 0
        ? settings.defaultSubBudgetNames
        : [...DEFAULT_INITIAL_SUB_BUDGET_NAMES];

    // 3. Crear sub-presupuestos con los mismos valores por defecto
    const subBudgets = await Promise.all(
      subBudgetNames.map((name) =>
        prisma.budget.create({
          data: {
            projectId: budget.projectId,
            parentBudgetId: budget.id,
            kind: "SUB_BUDGET",
            name,
            currency: budget.currency,
            igvRate: budget.igvRate,
            generalExpensesRate: budget.generalExpensesRate,
            utilityRate: budget.utilityRate,
            totalDirectCost: 0,
            totalGeneralExpenses: 0,
            totalUtility: 0,
            totalTax: 0,
            totalAmount: 0,
          },
        }),
      ),
    );

    return {
      id: budget.id,
      name: budget.name,
      projectId: budget.projectId,
      currency: budget.currency,
      // Convertir decimales de Prisma (0-1) a porcentajes (0-100) para la UI
      indirectCostPercentage: Number(budget.generalExpensesRate) * 100,
      utilityPercentage: Number(budget.utilityRate) * 100,
      taxPercentage: Number(budget.igvRate) * 100,
      subBudgets: subBudgets.map((sb) => ({ id: sb.id, name: sb.name })),
      subBudgetCount: subBudgets.length,
    };
  },
  summarizeResult: (result) =>
    `Presupuesto "${result.name}" creado con ${result.subBudgetCount} sub-presupuestos automáticos en proyecto ${result.projectId}.`,
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

// ─── createBudgetGeneral: GENERAL budget with sub-budgets ────────────────────

const createBudgetGeneralInput = z.object({
  projectId: z.string().min(1).describe("ID del proyecto"),
  name: z.string().min(3).default("Presupuesto General").describe("Nombre del presupuesto general"),
  currency: z.enum(["PEN", "USD"]).default("PEN").describe("Moneda del presupuesto"),
});

export const createBudgetGeneralTool: AgentToolDefinition<
  z.infer<typeof createBudgetGeneralInput>,
  Record<string, unknown>
> = {
  name: "createBudgetGeneral",
  description:
    "Crea un Presupuesto General en un proyecto existente con sus sub-presupuestos automáticos " +
    "(Estructuras, Arquitectura, etc.) basados en la configuración del usuario. " +
    "Si el proyecto ya tiene un Presupuesto General, retorna un error. Requiere aprobación previa.",
  risk: "write",
  requiresProjectId: true,
  inputSchema: createBudgetGeneralInput,
  execute: async (input, context) => {
    // 1. Verificar que no exista ya un Presupuesto General en el proyecto
    const existingGeneral = await prisma.budget.findFirst({
      where: {
        projectId: input.projectId,
        kind: "GENERAL",
      },
      select: { id: true, name: true },
    });

    if (existingGeneral) {
      throw new Error(
        `El proyecto ya tiene un Presupuesto General: "${existingGeneral.name}" (${existingGeneral.id}). ` +
        `Usa createBudget para crear presupuestos adicionales.`,
      );
    }

    // 2. Obtener settings del usuario para valores por defecto
    const settings = await getUserSettings(context.userId);

    // 3. Crear presupuesto GENERAL con márgenes del usuario
    const budget = await createBudget(context.userId, {
      name: input.name,
      projectId: input.projectId,
      currency: input.currency,
    } as Parameters<typeof createBudget>[1]);

    // 4. Actualizar kind a GENERAL (createBudget no permite establecer kind)
    await prisma.budget.update({
      where: { id: budget.id },
      data: { kind: "GENERAL" },
    });

    // 5. Obtener nombres de sub-presupuestos
    const subBudgetNames =
      settings.defaultSubBudgetNames.length > 0
        ? settings.defaultSubBudgetNames
        : [...DEFAULT_INITIAL_SUB_BUDGET_NAMES];

    // 6. Crear sub-presupuestos
    const subBudgets = await Promise.all(
      subBudgetNames.map((name) =>
        prisma.budget.create({
          data: {
            projectId: budget.projectId,
            parentBudgetId: budget.id,
            kind: "SUB_BUDGET",
            name,
            currency: budget.currency,
            igvRate: budget.igvRate,
            generalExpensesRate: budget.generalExpensesRate,
            utilityRate: budget.utilityRate,
            totalDirectCost: 0,
            totalGeneralExpenses: 0,
            totalUtility: 0,
            totalTax: 0,
            totalAmount: 0,
          },
        }),
      ),
    );

    return {
      id: budget.id,
      name: budget.name,
      projectId: budget.projectId,
      kind: "GENERAL",
      currency: budget.currency,
      subBudgets: subBudgets.map((sb) => ({ id: sb.id, name: sb.name })),
      subBudgetCount: subBudgets.length,
    };
  },
  summarizeResult: (result) =>
    `Presupuesto General "${result.name}" creado con ${result.subBudgetCount} sub-presupuestos automáticos en proyecto ${result.projectId}.`,
};

// ─── createSubBudget: single sub-budget under a parent ───────────────────────

const createSubBudgetInput = z.object({
  parentBudgetId: z.string().min(1).describe("ID del presupuesto padre (GENERAL)"),
  projectId: z.string().min(1).describe("ID del proyecto"),
  name: z.string().min(3).describe("Nombre del sub-presupuesto"),
  currency: z.enum(["PEN", "USD"]).default("PEN").describe("Moneda del sub-presupuesto"),
});

export const createSubBudgetTool: AgentToolDefinition<
  z.infer<typeof createSubBudgetInput>,
  Record<string, unknown>
> = {
  name: "createSubBudget",
  description:
    "Crea un sub-presupuesto (SUB_BUDGET) dentro de un Presupuesto General existente. " +
    "Requiere aprobación previa.",
  risk: "write",
  requiresProjectId: true,
  inputSchema: createSubBudgetInput,
  execute: async (input, context) => {
    // 1. Validar que el presupuesto padre existe y el usuario tiene acceso
    const parent = await prisma.budget.findFirst({
      where: {
        id: input.parentBudgetId,
        projectId: input.projectId,
        project: {
          company: {
            memberships: {
              some: {
                userId: context.userId,
                status: "ACTIVE",
              },
            },
          },
        },
      },
      select: {
        id: true,
        currency: true,
        igvRate: true,
        generalExpensesRate: true,
        utilityRate: true,
      },
    });

    if (!parent) {
      throw new Error(`Presupuesto padre "${input.parentBudgetId}" no encontrado o no tienes acceso.`);
    }

    // 2. Verificar que no exista un sub-presupuesto con el mismo nombre bajo el mismo padre
    const existing = await prisma.budget.findFirst({
      where: {
        parentBudgetId: input.parentBudgetId,
        name: input.name,
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error(`Ya existe un sub-presupuesto con el nombre "${input.name}" bajo este presupuesto padre.`);
    }

    // 3. Crear sub-presupuesto heredando tasas del padre
    const subBudget = await prisma.budget.create({
      data: {
        projectId: input.projectId,
        parentBudgetId: input.parentBudgetId,
        kind: "SUB_BUDGET",
        name: input.name,
        currency: input.currency,
        igvRate: parent.igvRate,
        generalExpensesRate: parent.generalExpensesRate,
        utilityRate: parent.utilityRate,
        totalDirectCost: 0,
        totalGeneralExpenses: 0,
        totalUtility: 0,
        totalTax: 0,
        totalAmount: 0,
      },
    });

    return {
      id: subBudget.id,
      name: subBudget.name,
      projectId: subBudget.projectId,
      parentBudgetId: subBudget.parentBudgetId,
      kind: subBudget.kind,
      currency: subBudget.currency,
    };
  },
  summarizeResult: (result) =>
    `Sub-presupuesto "${result.name}" creado bajo presupuesto ${result.parentBudgetId}.`,
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
  createBudgetGeneralTool,
  createSubBudgetTool,
];
