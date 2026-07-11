import { z } from "zod";
import type { AgentToolDefinition } from "../types";
import { prisma } from "@/lib/db/prisma";
import { searchMcpTemplateCandidates } from "@/lib/ai/budget-generation/mcp-template-search";
import { previewBudgetFromMcpTemplate } from "@/lib/ai/budget-generation/mcp-budget-preview";
import { applyMcpBudgetBlueprintToProject } from "@/lib/ai/budget-generation/mcp-budget-applicator";

// ─── Helper ─────────────────────────────────────────────────────────────────

async function getProjectCompanyId(
  projectId: string,
  userId: string,
): Promise<string | null> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        memberships: {
          some: { userId, status: "ACTIVE" },
        },
      },
    },
    select: { companyId: true },
  });
  return project?.companyId ?? null;
}

// ─── searchMcpTemplates ─────────────────────────────────────────────────────

const searchMcpTemplatesInput = z.object({
  query: z.string().min(1).describe("Descripción de la obra a buscar (ej: 'vivienda de 2 pisos')"),
  projectType: z
    .string()
    .optional()
    .describe(
      "Tipo de proyecto: vivienda, edificio, colegio, hospital, carretera, industrial, otro",
    ),
  companyId: z.string().optional().describe("ID de la empresa (opcional, usa el contexto si se omite)"),
  limit: z.number().int().min(1).max(10).default(5),
});

export const searchMcpTemplatesTool: AgentToolDefinition<
  z.infer<typeof searchMcpTemplatesInput>,
  Record<string, unknown>
> = {
  name: "searchMcpTemplates",
  description:
    "Busca paquetes .mcp (plantillas de proyectos exportados) que coincidan con la descripción y tipo de obra. " +
    "Retorna candidatos ordenados por score de similitud. Útil antes de generar un presupuesto desde plantilla.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: searchMcpTemplatesInput,
  execute: async (input, context) => {
    const candidates = await searchMcpTemplateCandidates({
      userId: context.userId,
      companyId: input.companyId ?? "",
      description: input.query,
      projectType: input.projectType,
      limit: input.limit,
    });

    return {
      query: input.query,
      projectType: input.projectType ?? null,
      count: candidates.length,
      candidates: candidates.map((c) => ({
        packageId: c.packageId,
        projectName: c.projectName,
        projectType: c.projectType,
        description: c.description,
        score: c.score,
        matchedKeywords: c.matchedKeywords,
        reasons: c.reasons,
      })),
    };
  },
  summarizeResult: (result) =>
    `${result.count} paquete${result.count === 1 ? "" : "s"} .mcp encontrado${result.count === 1 ? "" : "s"} para "${result.query}".`,
};

// ─── previewBudgetFromMcpTemplate ───────────────────────────────────────────

const previewBudgetFromMcpTemplateInput = z.object({
  projectId: z.string().min(1).describe("ID del proyecto destino"),
  packageId: z.string().min(1).describe("ID del paquete .mcp a usar como plantilla"),
  description: z
    .string()
    .min(10)
    .describe("Descripción de la obra para ajustar cantidades y contexto"),
});

export const previewBudgetFromMcpTemplateTool: AgentToolDefinition<
  z.infer<typeof previewBudgetFromMcpTemplateInput>,
  Record<string, unknown>
> = {
  name: "previewBudgetFromMcpTemplate",
  description:
    "Genera una vista previa del presupuesto que se crearía desde una plantilla .mcp. " +
    "Muestra sub-presupuestos, conteo de partidas, coincidencias con catálogo y advertencias. " +
    "No modifica la base de datos. Usa esto antes de aplicar la plantilla.",
  risk: "read",
  requiresProjectId: true,
  inputSchema: previewBudgetFromMcpTemplateInput,
  execute: async (input, context) => {
    const preview = await previewBudgetFromMcpTemplate({
      userId: context.userId,
      projectId: input.projectId,
      packageId: input.packageId,
      description: input.description,
    });

    return {
      packageId: preview.packageId,
      sourceProjectName: preview.sourceProjectName,
      targetProjectId: preview.targetProjectId,
      templateScore: preview.templateScore,
      subBudgets: preview.subBudgets.map((sb) => ({
        name: sb.name,
        itemCount: sb.itemCount,
        matchedCatalogItems: sb.matchedCatalogItems,
        reviewRequiredItems: sb.reviewRequiredItems,
        unmatchedItems: sb.unmatchedItems,
        estimatedDirectCost: sb.estimatedDirectCost,
      })),
      totals: {
        estimatedDirectCost: preview.totals.estimatedDirectCost,
        matchedItems: preview.totals.matchedItems,
        reviewRequiredItems: preview.totals.reviewRequiredItems,
        unmatchedItems: preview.totals.unmatchedItems,
      },
      warnings: preview.warnings,
      assumptions: preview.assumptions,
    };
  },
  summarizeResult: (result) =>
    `Vista previa: ${result.subBudgets.length} sub-presupuestos, ${result.totals.matchedItems} partidas OK, ${result.totals.reviewRequiredItems} requieren revisión.`,
};

// ─── applyBudgetFromMcpTemplate ─────────────────────────────────────────────

const applyBudgetFromMcpTemplateInput = z.object({
  projectId: z.string().min(1).describe("ID del proyecto destino"),
  packageId: z.string().min(1).describe("ID del paquete .mcp a aplicar"),
  description: z
    .string()
    .min(10)
    .describe("Descripción de la obra para ajustar cantidades"),
  mode: z
    .enum(["auto", "review_required"])
    .default("review_required")
    .describe(
      "Modo de aplicación: 'auto' aplica todas las partidas, 'review_required' solo las de alta coincidencia",
    ),
});

export const applyBudgetFromMcpTemplateTool: AgentToolDefinition<
  z.infer<typeof applyBudgetFromMcpTemplateInput>,
  Record<string, unknown>
> = {
  name: "applyBudgetFromMcpTemplate",
  description:
    "Aplica una plantilla .mcp a un proyecto existente, creando sub-presupuestos, niveles y partidas. " +
    "Solo crea sub-presupuestos que no existan. Las partidas se vinculan al catálogo cuando hay coincidencia. " +
    "Requiere aprobación previa. Usa previewBudgetFromMcpTemplate primero para revisar el resultado esperado.",
  risk: "financial",
  requiresProjectId: true,
  inputSchema: applyBudgetFromMcpTemplateInput,
  execute: async (input, context) => {
    const companyId = await getProjectCompanyId(input.projectId, context.userId);
    if (!companyId) {
      throw new Error("No tienes acceso al proyecto especificado.");
    }

    const result = await applyMcpBudgetBlueprintToProject({
      userId: context.userId,
      companyId,
      projectId: input.projectId,
      packageId: input.packageId,
      description: input.description,
      mode: input.mode,
    });

    return {
      projectId: result.projectId,
      generalBudgetId: result.generalBudgetId,
      packageId: result.packageId,
      sourceProjectName: result.sourceProjectName,
      subBudgets: result.subBudgets.map((sb) => ({
        budgetId: sb.budgetId,
        name: sb.name,
        levelsCreated: sb.levelsCreated,
        itemsCreated: sb.itemsCreated,
        apusCreated: sb.apusCreated,
        directCost: sb.directCost,
      })),
      skippedItems: result.skippedItems.map((si) => ({
        sourceItemId: si.sourceItemId,
        description: si.description,
        reason: si.reason,
      })),
      totalItemsCreated: result.subBudgets.reduce(
        (sum, sb) => sum + sb.itemsCreated,
        0,
      ),
      totalSkipped: result.skippedItems.length,
      warnings: result.warnings,
    };
  },
  summarizeResult: (result) => {
    const totalCreated = result.subBudgets.reduce(
      (sum, sb) =>
        sum +
        sb.levelsCreated +
        sb.itemsCreated +
        sb.apusCreated,
      0,
    );
    return `Plantilla aplicada: ${result.subBudgets.length} sub-presupuestos, ${totalCreated} elementos creados, ${result.totalSkipped} partidas omitidas.`;
  },
};

// ─── Tool array ─────────────────────────────────────────────────────────────

export const mcpBudgetTools: AgentToolDefinition<any, any>[] = [
  searchMcpTemplatesTool,
  previewBudgetFromMcpTemplateTool,
  applyBudgetFromMcpTemplateTool,
];
