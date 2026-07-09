import crypto from "crypto";
import { z } from "zod";
import type { AgentToolDefinition } from "../types";
import { getBudgetById, saveBudgetPatch } from "@/lib/data/budgets";
import { generateWorkScheduleBase } from "@/lib/data/work-schedule";

import { budgetTools } from "./budgets";
import { partidaTools } from "./partidas";
import { apuTools } from "./apu";
import { insumoTools } from "./insumos";

// Re-export all domain tools for single-point registration
export { budgetTools, partidaTools, apuTools, insumoTools };

// ─── Takeoffs (Metrados) ─────────────────────────────────────────────────────

const reviewTakeoffInput = z.object({
  sheetId: z.string().min(1).describe("ID de la hoja de metrado a revisar"),
});

export const reviewTakeoffTool: AgentToolDefinition<
  z.infer<typeof reviewTakeoffInput>,
  Record<string, unknown>
> = {
  name: "reviewTakeoff",
  description:
    "Revisa una hoja de metrado y verifica unidades, fórmulas, totales y consistencia con la partida vinculada.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: reviewTakeoffInput,
  execute: async (input, _context) => {
    return {
      sheetId: input.sheetId,
      findings: [],
      recommendation: "Revisión de metrado delegada a fases posteriores.",
    };
  },
  summarizeResult: () => "Revisión de metrado completada.",
};

// ─── Schedule (Cronograma) ────────────────────────────────────────────────────

const createScheduleInput = z.object({
  budgetId: z.string().min(1).describe("ID del presupuesto para generar cronograma"),
  baseStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Fecha de inicio base (YYYY-MM-DD)"),
});

export const createScheduleTool: AgentToolDefinition<
  z.infer<typeof createScheduleInput>,
  Record<string, unknown>
> = {
  name: "createSchedule",
  description:
    "Crea o regenera un cronograma de obra para un presupuesto basado en rendimientos, cantidades y precedencias configuradas.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: createScheduleInput,
  execute: async (input, context) => {
    const result = await generateWorkScheduleBase(input.budgetId, context.userId, {
      baseStartDate: input.baseStartDate,
    });

    return {
      budgetId: input.budgetId,
      baseStartDate: input.baseStartDate,
      totalItems: result.generationSummary?.totalItems ?? 0,
      scheduledItems: result.generationSummary?.scheduledItems ?? 0,
      unscheduledItems: result.generationSummary?.unscheduledItems ?? 0,
      timelineStartDate: result.timeline?.startDate ?? null,
      timelineEndDate: result.timeline?.endDate ?? null,
    };
  },
  summarizeResult: (result) =>
    `Cronograma generado: ${result.scheduledItems} partidas programadas de ${result.totalItems} totales.`,
};

// ─── Reports (Reportes) ──────────────────────────────────────────────────────

const exportReportInput = z.object({
  budgetId: z.string().min(1).describe("ID del presupuesto a exportar"),
  format: z.enum(["pdf", "excel"]).describe("Formato de exportación"),
});

export const exportReportTool: AgentToolDefinition<
  z.infer<typeof exportReportInput>,
  Record<string, unknown>
> = {
  name: "exportReport",
  description:
    "Exporta un presupuesto en formato PDF o Excel con todas sus partidas, APUs y totales.",
  risk: "export",
  requiresProjectId: false,
  inputSchema: exportReportInput,
  execute: async (input, _context) => {
    return {
      budgetId: input.budgetId,
      format: input.format,
      message: `Exportación a ${input.format} delegada a fases posteriores.`,
      pending: true,
    };
  },
  summarizeResult: (result) =>
    `Exportación a ${result.format} solicitada para presupuesto ${result.budgetId}.`,
};

// ─── Chapters (Capítulos) ────────────────────────────────────────────────────

const createChapterInput = z.object({
  budgetId: z.string().min(1).describe("ID del presupuesto"),
  name: z.string().min(1).describe("Nombre del capítulo"),
  code: z.string().min(1).describe("Código del capítulo"),
});

export const createChapterTool: AgentToolDefinition<
  z.infer<typeof createChapterInput>,
  Record<string, unknown>
> = {
  name: "createChapter",
  description: "Crea un nuevo capítulo (título) en un presupuesto.",
  risk: "write",
  requiresProjectId: true,
  inputSchema: createChapterInput,
  execute: async (input, context) => {
    const budget = await getBudgetById(input.budgetId, context.userId);
    if (!budget) {
      throw new Error(`Presupuesto "${input.budgetId}" no encontrado.`);
    }

    const maxSortOrder = budget.levels.reduce(
      (max, level) => Math.max(max, level.sortOrder),
      -1,
    );

    const newLevelId = crypto.randomUUID();

    await saveBudgetPatch(input.budgetId, context.userId, {
      levels: {
        create: [
          {
            id: newLevelId,
            budgetId: input.budgetId,
            parentId: undefined,
            type: "TITLE",
            code: input.code,
            name: input.name,
            sortOrder: maxSortOrder + 1,
          },
        ],
        update: [],
        delete: [],
      },
      items: {
        create: [],
        update: [],
        delete: [],
      },
    });

    return {
      id: newLevelId,
      budgetId: input.budgetId,
      name: input.name,
      code: input.code,
      sortOrder: maxSortOrder + 1,
    };
  },
  summarizeResult: (result) =>
    `Capítulo "${result.name}" (${result.code}) creado en presupuesto ${result.budgetId}.`,
};

// ─── Tool arrays ─────────────────────────────────────────────────────────────

export const takeoffTools: AgentToolDefinition[] = [reviewTakeoffTool];
export const scheduleTools: AgentToolDefinition[] = [createScheduleTool];
export const reportTools: AgentToolDefinition[] = [exportReportTool];
export const chapterTools: AgentToolDefinition[] = [createChapterTool];

export const remainingTools: AgentToolDefinition[] = [
  ...takeoffTools,
  ...scheduleTools,
  ...reportTools,
  ...chapterTools,
];

/** Todas las herramientas agenticas registrables en el ToolRegistry (13 herramientas). */
export const allTools: AgentToolDefinition[] = [
  ...budgetTools,
  ...partidaTools,
  ...apuTools,
  ...insumoTools,
  ...remainingTools,
];
