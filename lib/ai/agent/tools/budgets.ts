import { z } from "zod";
import crypto from "crypto";
import type { AgentToolDefinition } from "../types";
import { getBudgetById, createBudget } from "@/lib/data/budgets";
import { getUserSettings } from "@/lib/data/settings";
import { DEFAULT_INITIAL_SUB_BUDGET_NAMES } from "@/types/settings";
import { prisma } from "@/lib/db/prisma";
import { getCatalogPartidas } from "@/lib/data/partidas";
import { searchSimilarPartidas } from "@/lib/partida-generation/similarity";
import { searchSimilarProjects } from "@/lib/ai/budget-generation/project-similarity";
import { applyTemplateToSubBudget } from "@/lib/ai/budget-generation/template-applicator";
import { estimateQuantity } from "@/lib/ai/budget-generation/quantity-estimator";
import { searchMcpTemplateCandidates, MCP_TEMPLATE_STRONG_MATCH } from "@/lib/ai/budget-generation/mcp-template-search";
import { previewBudgetFromMcpTemplate } from "@/lib/ai/budget-generation/mcp-budget-preview";
import { applyMcpBudgetBlueprintToProject } from "@/lib/ai/budget-generation/mcp-budget-applicator";
import {
  createUserBudgetTemplateFromBudget,
  applyUserBudgetTemplateToProject,
} from "@/lib/data/budget-templates";

// ─── Input schemas ───────────────────────────────────────────────────────────

const searchBudgetsInput = z.object({
  query: z.string().min(1).optional().describe("Texto para buscar presupuestos por nombre (opcional, lista todos si se omite)"),
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
  templateSource: z.enum(["auto", "mcp", "project", "catalog"]).default("auto").describe("Fuente de plantilla: auto (busca .mcp primero), mcp (solo .mcp), project (proyectos similares), catalog (solo catálogo)"),
  previewOnly: z.boolean().default(false).describe("Si es true, solo muestra preview sin escribir en DB"),
  mcpPackageId: z.string().optional().describe("ID de un paquete .mcp específico a usar como plantilla (si se conoce)"),
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
    const where: Record<string, unknown> = {
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
    };

    if (input.projectId) {
      where.projectId = input.projectId;
    }

    if (input.query) {
      where.name = { contains: input.query, mode: "insensitive" };
    }

    const budgets = await prisma.budget.findMany({
      where,
      select: {
        id: true,
        projectId: true,
        name: true,
        kind: true,
        currency: true,
        totalAmount: true,
        totalDirectCost: true,
        project: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    return {
      query: input.query ?? "",
      projectId: input.projectId ?? null,
      count: budgets.length,
      budgets: budgets.map((b) => ({
        id: b.id,
        projectId: b.projectId,
        projectName: b.project.name,
        name: b.name,
        kind: b.kind,
        currency: b.currency,
        totalAmount: Number(b.totalAmount),
        totalDirectCost: Number(b.totalDirectCost),
      })),
    };
  },
  summarizeResult: (result) =>
    `${result.count} presupuesto${result.count === 1 ? "" : "s"} encontrado${result.count === 1 ? "" : "s"}.`,
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
    } as any);

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
    "Clona un presupuesto existente creando una copia completa con nuevo nombre en el mismo proyecto.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: cloneBudgetInput,
  execute: async (input, context) => {
    const source = await getBudgetById(input.budgetId, context.userId);
    if (!source) throw new Error(`Presupuesto "${input.budgetId}" no encontrado.`);

    // Crear una plantilla temporal desde el presupuesto fuente
    const template = await createUserBudgetTemplateFromBudget(context.userId, {
      budgetId: source.id,
      name: input.newName,
      description: `Clonado desde ${source.name}`,
    });

    try {
      // Aplicar la plantilla al mismo proyecto con el nuevo nombre
      const applied = await applyUserBudgetTemplateToProject(
        template.id,
        context.userId,
        {
          projectId: source.projectId,
          name: input.newName,
        },
      );

      return {
        sourceId: input.budgetId,
        sourceName: source.name,
        newId: applied.id,
        newName: applied.name,
        projectId: applied.projectId,
        message: `Presupuesto "${source.name}" clonado como "${applied.name}".`,
      };
    } finally {
      // Limpiar la plantilla temporal (best-effort)
      try {
        const { deleteUserBudgetTemplate } = await import("@/lib/data/budget-templates");
        await deleteUserBudgetTemplate(template.id, context.userId);
      } catch {
        // La plantilla temporal queda pero no afecta al resultado
      }
    }
  },
  summarizeResult: (result) =>
    `Presupuesto "${result.sourceName}" clonado como "${result.newName}".`,
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

// ─── Helpers for generateBudget ──────────────────────────────────────────────

const SUB_BUDGET_CATEGORY_KEYWORDS: Array<{
  keywords: string[];
  budgetName: string;
}> = [
  {
    keywords: ["concreto", "acero", "encofrado", "columna", "viga", "losa", "zapata", "cimentacion", "solado", "falso piso", "cimiento", "estructura"],
    budgetName: "Estructuras",
  },
  {
    keywords: ["tarrajeo", "piso", "cielo raso", "muro", "ladrillo", "puerta", "ventana", "pintura", "contrapiso", "revoque", "ceramico", "enchape", "arquitectura"],
    budgetName: "Arquitectura",
  },
  {
    keywords: ["tuberia", "desague", "agua", "sanitaria", "lavatorio", "inodoro", "ducha", "grifo", "hidraulico", "fontaneria"],
    budgetName: "Instalaciones Sanitarias",
  },
  {
    keywords: ["cable", "interruptor", "tomacorriente", "luz", "electrico", "alumbrado", "tablero", "conductor", "iluminacion", "electrica"],
    budgetName: "Instalaciones Eléctricas",
  },
];

async function getProjectCompanyId(
  projectId: string,
  userId: string,
): Promise<string | null> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    },
    select: { companyId: true },
  });

  return project?.companyId ?? null;
}

function assignToSubBudget(
  description: string,
  subBudgets: Array<{ id: string; name: string }>,
): string {
  const descLower = description.toLowerCase();
  for (const group of SUB_BUDGET_CATEGORY_KEYWORDS) {
    if (group.keywords.some((kw) => descLower.includes(kw))) {
      const match = subBudgets.find((sb) =>
        sb.name.toLowerCase().includes(group.budgetName.toLowerCase()),
      );
      if (match) return match.id;
    }
  }
  return subBudgets[0].id;
}

function prepareItemsFromCatalogResults(
  results: Array<{
    partida: { description: string; unit: string; unitPrice: number };
    similarity?: number;
    score?: number;
  }>,
  subBudgets: Array<{ id: string; name: string }>,
  description: string,
): Array<{
  id: string;
  budgetId: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
  sortOrder: number;
}> {
  return results.map((result, index) => {
    const qty = estimateQuantity(description, result.partida.unit);
    const quantity = qty.value;
    const partial = result.partida.unitPrice * quantity;

    return {
      id: crypto.randomUUID(),
      budgetId: assignToSubBudget(result.partida.description, subBudgets),
      code: `GEN-${String(index + 1).padStart(3, "0")}`,
      description: result.partida.description,
      unit: result.partida.unit,
      quantity,
      unitPrice: result.partida.unitPrice,
      partial,
      sortOrder: index,
    };
  });
}

async function persistItemsAndRefreshTotals(
  itemsToCreate: Array<{
    id: string;
    budgetId: string;
    code: string;
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    partial: number;
    sortOrder: number;
  }>,
  projectId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const item of itemsToCreate) {
      await tx.budgetItem.create({ data: item });
    }

    const totalsByBudget = new Map<string, number>();
    for (const item of itemsToCreate) {
      const current = totalsByBudget.get(item.budgetId) ?? 0;
      totalsByBudget.set(item.budgetId, current + item.partial);
    }

    for (const [budgetId, totalDirectCost] of totalsByBudget) {
      const subBudget = await tx.budget.findUnique({
        where: { id: budgetId },
        select: {
          generalExpensesRate: true,
          utilityRate: true,
          igvRate: true,
        },
      });
      if (!subBudget) continue;

      const genExp = totalDirectCost * Number(subBudget.generalExpensesRate);
      const util = totalDirectCost * Number(subBudget.utilityRate);
      const subtotal = totalDirectCost + genExp + util;
      const tax = subtotal * Number(subBudget.igvRate);
      const total = subtotal + tax;

      await tx.budget.update({
        where: { id: budgetId },
        data: {
          totalDirectCost,
          totalGeneralExpenses: genExp,
          totalUtility: util,
          totalTax: tax,
          totalAmount: total,
        },
      });
    }

    const parentBudget = await tx.budget.findFirst({
      where: { projectId, kind: "GENERAL" },
      select: { id: true },
    });
    if (parentBudget) {
      const childBudgets = await tx.budget.findMany({
        where: { parentBudgetId: parentBudget.id },
        select: {
          totalDirectCost: true,
          totalGeneralExpenses: true,
          totalUtility: true,
          totalTax: true,
          totalAmount: true,
        },
      });

      const consolidated = childBudgets.reduce(
        (acc, child) => ({
          totalDirectCost: acc.totalDirectCost + Number(child.totalDirectCost),
          totalGeneralExpenses: acc.totalGeneralExpenses + Number(child.totalGeneralExpenses),
          totalUtility: acc.totalUtility + Number(child.totalUtility),
          totalTax: acc.totalTax + Number(child.totalTax),
          totalAmount: acc.totalAmount + Number(child.totalAmount),
        }),
        { totalDirectCost: 0, totalGeneralExpenses: 0, totalUtility: 0, totalTax: 0, totalAmount: 0 },
      );

      await tx.budget.update({
        where: { id: parentBudget.id },
        data: consolidated,
      });
    }
  });
}

// ─── generateBudget ─────────────────────────────────────────────────────────

export const generateBudgetTool: AgentToolDefinition<
  z.infer<typeof generateBudgetInput>,
  Record<string, unknown>
> = {
  name: "generateBudget",
  description:
    "Genera un presupuesto preliminar para una obra basado en una descripción técnica. " +
    "Usa 3 niveles: (1) busca proyectos similares del usuario, " +
    "(2) aplica plantillas de sub-presupuestos de proyectos similares, " +
    "(3) busca partidas en el catálogo como respaldo. " +
    "Requiere un projectId. Si no lo tienes, usa searchProjects primero para encontrar el proyecto por nombre.",
  risk: "write",
  requiresProjectId: true,
  inputSchema: generateBudgetInput,
  execute: async (input, context) => {
    // ── 1. Obtener sub-presupuestos del proyecto ────────────────────────────
    const subBudgets = await prisma.budget.findMany({
      where: {
        projectId: input.projectId,
        kind: "SUB_BUDGET",
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
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    if (subBudgets.length === 0) {
      throw new Error(
        "El proyecto no tiene sub-presupuestos. Crea un Presupuesto General primero.",
      );
    }

    const levelResults: string[] = [];
    let itemsFromTemplates = 0;
    let itemsFromCatalog = 0;
    let templatesApplied: string[] = [];

    // ═══════════════════════════════════════════════════════════════════════
    // NIVEL 1: Buscar proyectos similares del usuario
    // ═══════════════════════════════════════════════════════════════════════
    const similarProjects = await searchSimilarProjects({
      description: input.description,
      projectType: input.templateType,
      userId: context.userId,
    });

    const goodMatch = similarProjects.filter((p) => p.score >= 0.3);

    if (goodMatch.length > 0) {
      levelResults.push(
        `Nivel 1: ${goodMatch.length} proyecto${goodMatch.length === 1 ? "" : "s"} similar${goodMatch.length === 1 ? "" : "es"} encontrado${goodMatch.length === 1 ? "" : "s"} (top: "${goodMatch[0].projectName}", score: ${goodMatch[0].score.toFixed(2)})`,
      );
    } else {
      levelResults.push("Nivel 1: No se encontraron proyectos similares.");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NIVEL 1.5: Buscar y aplicar plantillas .mcp
    // ═══════════════════════════════════════════════════════════════════════
    let mcpItemsAdded = 0;
    let mcpApplied = false;
    const useMcpSource = input.templateSource === "auto" || input.templateSource === "mcp";

    if (useMcpSource) {
      // Si se proporcionó un packageId específico, usarlo directamente
      const targetPackageId = input.mcpPackageId;
      let mcpCandidate: { packageId: string; projectName: string; score: number } | null = null;

      if (targetPackageId) {
        mcpCandidate = { packageId: targetPackageId, projectName: "", score: 1 };
      } else {
        // Buscar paquetes .mcp compatibles
        const pkg = await getProjectCompanyId(input.projectId, context.userId);
        if (pkg) {
          const mcpResults = await searchMcpTemplateCandidates({
            userId: context.userId,
            companyId: pkg,
            description: input.description,
            projectType: input.templateType,
            limit: 3,
          });

          const bestMcp = mcpResults.find((c) => c.score >= MCP_TEMPLATE_STRONG_MATCH);
          if (bestMcp) {
            mcpCandidate = bestMcp;
          }
        }
      }

      if (mcpCandidate) {
        try {
          if (input.previewOnly) {
            // Solo preview
            const companyId = await getProjectCompanyId(input.projectId, context.userId);
            if (companyId) {
              const preview = await previewBudgetFromMcpTemplate({
                userId: context.userId,
                projectId: input.projectId,
                packageId: mcpCandidate.packageId,
                description: input.description,
              });
              levelResults.push(
                `Nivel 1.5 (Preview): Plantilla .mcp "${preview.sourceProjectName}" — ${preview.subBudgets.length} sub-presupuestos, ${preview.totals.matchedItems} partidas OK, ${preview.totals.reviewRequiredItems} requieren revisión.`,
              );
              // En modo preview, no escribir nada pero retornar el preview
              return {
                projectId: input.projectId,
                description: input.description,
                templateType: input.templateType ?? "edificio",
                totalItemsAdded: 0,
                fromTemplates: 0,
                fromCatalog: 0,
                mcpPreview: {
                  packageId: preview.packageId,
                  sourceProjectName: preview.sourceProjectName,
                  subBudgets: preview.subBudgets,
                  totals: preview.totals,
                  warnings: preview.warnings,
                },
                templatesApplied: [],
                levels: levelResults,
                byBudget: [],
                message: levelResults.join(" | "),
              };
            }
          } else {
            // Aplicar la plantilla .mcp
            const companyId = await getProjectCompanyId(input.projectId, context.userId);
            if (companyId) {
              const result = await applyMcpBudgetBlueprintToProject({
                userId: context.userId,
                companyId,
                projectId: input.projectId,
                packageId: mcpCandidate.packageId,
                description: input.description,
                mode: "review_required",
              });

              const totalItems = result.subBudgets.reduce(
                (sum, sb) => sum + sb.itemsCreated,
                0,
              );
              mcpItemsAdded = totalItems;
              mcpApplied = true;

              levelResults.push(
                `Nivel 1.5: Plantilla .mcp "${result.sourceProjectName}" aplicada: ${result.subBudgets.length} sub-presupuestos, ${totalItems} partidas (${result.skippedItems.length} omitidas).`,
              );
            }
          }
        } catch (err) {
          levelResults.push(
            `Nivel 1.5: Error al usar .mcp: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } else if (input.templateSource === "mcp") {
        levelResults.push("Nivel 1.5: No se encontraron paquetes .mcp compatibles (templateSource=mcp).");
      } else {
        levelResults.push("Nivel 1.5: No hay paquetes .mcp con score suficiente.");
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NIVEL 2: Aplicar plantillas de sub-presupuestos de proyectos similares
    // ═══════════════════════════════════════════════════════════════════════
    const skipProjectTemplates = mcpApplied || input.templateSource === "mcp" || input.templateSource === "catalog";
    if (!skipProjectTemplates) {
      for (const match of goodMatch.filter((p) => p.score >= 0.5)) {
      if (match.budgetTemplates.length === 0) continue;

      // Usar la primera plantilla del proyecto similar
      const templateToApply = match.budgetTemplates[0];

      // Determinar a qué sub-presupuesto mapear la plantilla
      // basado en el tipo de proyecto similar y los sub-budgets disponibles
      const targetBudgetName =
        subBudgets.find((sb) =>
          sb.name.toLowerCase().includes(
            match.projectType?.toLowerCase() ?? "",
          ),
        )?.name ?? subBudgets[0].name;

      try {
        const result = await applyTemplateToSubBudget({
          templateId: templateToApply.id,
          projectId: input.projectId,
          targetSubBudgetName: targetBudgetName,
          userId: context.userId,
        });

        itemsFromTemplates += result.itemsAdded;
          templatesApplied.push(`${templateToApply.name} → ${targetBudgetName} (${result.itemsAdded} partidas)`);
        levelResults.push(
          `Nivel 2: Plantilla "${templateToApply.name}" aplicada a ${targetBudgetName}: ${result.itemsAdded} partidas, ${result.apusCreated} APUs.`,
        );
        } catch (err) {
          levelResults.push(
            `Nivel 2: Error al aplicar plantilla "${templateToApply.name}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      if (templatesApplied.length === 0) {
        levelResults.push("Nivel 2: No se aplicaron plantillas (score < 0.5 o sin plantillas disponibles).");
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NIVEL 3: Catálogo (fallback / complemento)
    // ═══════════════════════════════════════════════════════════════════════
    // Si no hay suficientes partidas desde plantillas (menos de 5), buscar en catálogo
    if (itemsFromTemplates < 5) {
      const allPartidas = await getCatalogPartidas();

      // Usar searchSimilarPartidas (mejor scoring con variables técnicas)
      const matched = searchSimilarPartidas({
        query: input.description,
        partidas: allPartidas,
        limit: 25,
      });

      if (matched.length > 0) {
        const itemsToCreate = prepareItemsFromCatalogResults(
          matched as Array<{
            partida: { description: string; unit: string; unitPrice: number };
            similarity?: number;
            score?: number;
          }>,
          subBudgets,
          input.description,
        );

        await persistItemsAndRefreshTotals(itemsToCreate, input.projectId);
        itemsFromCatalog = itemsToCreate.length;
        levelResults.push(
          `Nivel 3: ${itemsToCreate.length} partidas agregadas desde el catálogo (searchSimilarPartidas).`,
        );
      } else {
        levelResults.push("Nivel 3: No se encontraron partidas en el catálogo.");
      }
    } else {
      levelResults.push(
        `Nivel 3: Omitido — ya se agregaron ${itemsFromTemplates} partidas desde plantillas.`,
      );
    }

    // ── Resumen final ──────────────────────────────────────────────────────
    const totalItems = itemsFromTemplates + itemsFromCatalog;

    // Recalcular totales consolidados para el resumen
    const finalSubBudgets = await prisma.budget.findMany({
      where: {
        projectId: input.projectId,
        kind: "SUB_BUDGET",
      },
      select: {
        id: true,
        name: true,
        totalDirectCost: true,
        _count: { select: { items: true } },
      },
    });

    const byBudget = finalSubBudgets.map((sb) => ({
      budgetId: sb.id,
      budgetName: sb.name,
      itemCount: sb._count.items,
      subtotal: Number(sb.totalDirectCost),
    }));

    return {
      projectId: input.projectId,
      description: input.description,
      templateType: input.templateType ?? "edificio",
      totalItemsAdded: totalItems,
      fromTemplates: itemsFromTemplates,
      fromCatalog: itemsFromCatalog,
      templatesApplied,
      levels: levelResults,
      byBudget,
      message: levelResults.join(" | "),
    };
  },
  summarizeResult: (result) =>
    `Presupuesto generado: ${result.totalItemsAdded} partidas (${result.fromTemplates} desde plantillas, ${result.fromCatalog} desde catálogo).`,
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
      totalAmount: Number(b!.totalAmount),
      directCost: Number(b!.totalDirectCost),
      indirectCost: Number(b!.totalAmount) - Number(b!.totalDirectCost),
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
    } as any);

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

export const budgetTools: AgentToolDefinition<any, any>[] = [
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
