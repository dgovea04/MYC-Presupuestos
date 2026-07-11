import crypto from "crypto";
import { z } from "zod";
import type { AgentToolDefinition } from "../types";
import { getBudgetById, saveBudgetPatch } from "@/lib/data/budgets";
import { generateWorkScheduleBase, saveWorkScheduleItem } from "@/lib/data/work-schedule";
import { getWorkScheduleSection } from "@/lib/data/work-schedule";
import { createMetradoSheet, duplicateMetradoSheet } from "@/lib/data/metrados";
import { calculateWorkScheduleCriticalPath } from "@/lib/work-schedule/critical-path";
import { createApuWorkbook, createBudgetWorkbook } from "@/lib/exports/excel";

import { budgetTools } from "./budgets";
import { partidaTools } from "./partidas";
import { apuTools } from "./apu";
import { insumoTools } from "./insumos";
import { projectTools } from "./projects";
import { mcpBudgetTools } from "./mcp-budget";

// Re-export all domain tools for single-point registration
export { budgetTools, partidaTools, apuTools, insumoTools, projectTools, mcpBudgetTools };

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

// ─── Chapter management tools ─────────────────────────────────────────────────

const moveChapterInput = z.object({
  budgetId: z.string().min(1),
  chapterId: z.string().min(1),
  newSortOrder: z.number().int().nonnegative(),
});

export const moveChapterTool: AgentToolDefinition<
  z.infer<typeof moveChapterInput>,
  Record<string, unknown>
> = {
  name: "moveChapter",
  description: "Reordena un capítulo dentro de un presupuesto cambiando su posición (sort order).",
  risk: "write",
  requiresProjectId: false,
  inputSchema: moveChapterInput,
  execute: async (input, context) => {
    const budget = await getBudgetById(input.budgetId, context.userId);
    if (!budget) throw new Error(`Presupuesto "${input.budgetId}" no encontrado.`);
    const level = budget.levels.find((l) => l.id === input.chapterId);
    if (!level) throw new Error(`Capítulo "${input.chapterId}" no encontrado.`);
    await saveBudgetPatch(input.budgetId, context.userId, {
      levels: { create: [], update: [{ id: input.chapterId, sortOrder: input.newSortOrder }], delete: [] },
      items: { create: [], update: [], delete: [] },
    });
    return { chapterId: input.chapterId, newSortOrder: input.newSortOrder };
  },
  summarizeResult: (result) => `Capítulo ${result.chapterId} movido a posición ${result.newSortOrder}.`,
};

const deleteChapterInput = z.object({
  budgetId: z.string().min(1),
  chapterId: z.string().min(1),
});

export const deleteChapterTool: AgentToolDefinition<
  z.infer<typeof deleteChapterInput>,
  Record<string, unknown>
> = {
  name: "deleteChapter",
  description: "Elimina un capítulo de un presupuesto. Requiere aprobación previa.",
  risk: "financial",
  requiresProjectId: false,
  inputSchema: deleteChapterInput,
  execute: async (input, context) => {
    const budget = await getBudgetById(input.budgetId, context.userId);
    if (!budget) throw new Error(`Presupuesto "${input.budgetId}" no encontrado.`);
    await saveBudgetPatch(input.budgetId, context.userId, {
      levels: { create: [], update: [], delete: [{ id: input.chapterId }] },
      items: { create: [], update: [], delete: [] },
    });
    return { chapterId: input.chapterId, deleted: true };
  },
  summarizeResult: () => "Capítulo eliminado.",
};

// ─── Schedule management tools ────────────────────────────────────────────────

const updateTaskInput = z.object({
  budgetId: z.string().min(1),
  itemId: z.string().min(1),
  duration: z.number().int().positive().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateTaskTool: AgentToolDefinition<
  z.infer<typeof updateTaskInput>,
  Record<string, unknown>
> = {
  name: "updateTask",
  description: "Actualiza una tarea del cronograma: duración estimada o fecha de inicio.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: updateTaskInput,
  execute: async (input, context) => {
    const patch: Record<string, unknown> = { id: input.itemId };
    if (input.duration) patch.realDuration = input.duration;
    if (input.startDate) patch.startDate = input.startDate;
    await saveWorkScheduleItem(input.budgetId, context.userId, patch as Parameters<typeof saveWorkScheduleItem>[2]);
    return { itemId: input.itemId, updated: true };
  },
  summarizeResult: () => "Tarea de cronograma actualizada.",
};

const linkPredecessorInput = z.object({
  budgetId: z.string().min(1),
  itemId: z.string().min(1),
  predecessorItemId: z.string().min(1),
  type: z.enum(["FS", "SS", "FF", "SF"]).default("FS").describe("Tipo de dependencia (Finish-Start, Start-Start, Finish-Finish, Start-Finish)"),
});

export const linkPredecessorTool: AgentToolDefinition<
  z.infer<typeof linkPredecessorInput>,
  Record<string, unknown>
> = {
  name: "linkPredecessor",
  description: "Vincula una tarea del cronograma como predecesora de otra, estableciendo dependencia.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: linkPredecessorInput,
  execute: async (input, context) => {
    await saveWorkScheduleItem(input.budgetId, context.userId, {
      id: input.itemId,
      predecessorId: input.predecessorItemId,
      predecessorType: input.type,
    } as Parameters<typeof saveWorkScheduleItem>[2]);
    return { itemId: input.itemId, predecessorId: input.predecessorItemId, type: input.type };
  },
  summarizeResult: (result) => `Dependencia ${result.type} creada: ${result.predecessorItemId} → ${result.itemId}.`,
};

const moveTaskInput = z.object({
  budgetId: z.string().min(1),
  itemId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Nueva fecha de inicio"),
});

export const moveTaskTool: AgentToolDefinition<
  z.infer<typeof moveTaskInput>,
  Record<string, unknown>
> = {
  name: "moveTask",
  description: "Mueve una tarea del cronograma a una nueva fecha de inicio.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: moveTaskInput,
  execute: async (input, context) => {
    await saveWorkScheduleItem(input.budgetId, context.userId, {
      id: input.itemId,
      startDate: input.startDate,
    } as Parameters<typeof saveWorkScheduleItem>[2]);
    return { itemId: input.itemId, newStartDate: input.startDate };
  },
  summarizeResult: (result) => `Tarea ${result.itemId} movida a ${result.newStartDate}.`,
};

const calculateCriticalPathInput = z.object({
  budgetId: z.string().min(1),
});

export const calculateCriticalPathTool: AgentToolDefinition<
  z.infer<typeof calculateCriticalPathInput>,
  Record<string, unknown>
> = {
  name: "calculateCriticalPath",
  description: "Calcula la ruta crítica del cronograma de un presupuesto. Retorna tareas críticas, holguras y duración total del proyecto.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: calculateCriticalPathInput,
  execute: async (input, context) => {
    const section = await getWorkScheduleSection(input.budgetId, context.userId);
    const lines = section.lines.map((l) => ({
      budgetItemId: l.budgetItemId,
      durationDays: l.duration,
      startDate: l.startDate,
      endDate: l.endDate,
      predecessors: (l as Record<string, unknown>).predecessors as Array<{budgetItemId: string; type: string}> | undefined,
    }));
    const result = calculateWorkScheduleCriticalPath(lines);
    const criticalItems = [...result.itemsByBudgetItemId.values()].filter((i) => i.isCritical);
    return {
      budgetId: input.budgetId,
      projectDurationDays: result.projectDurationDays,
      criticalItemCount: criticalItems.length,
      totalItems: lines.length,
      status: result.status,
    };
  },
  summarizeResult: (result) =>
    `Ruta crítica: ${result.criticalItemCount} tareas críticas, duración ${result.projectDurationDays} días.`,
};

// ─── Takeoff (Metrados) management tools ──────────────────────────────────────

const createTakeoffInput = z.object({
  name: z.string().min(3),
  projectId: z.string().min(1),
  unit: z.enum(["m", "m2", "m3", "kg", "un", "glb", "p2", "ml", "mes", "dia"]).default("m2"),
});

export const createTakeoffTool: AgentToolDefinition<
  z.infer<typeof createTakeoffInput>,
  Record<string, unknown>
> = {
  name: "createTakeoff",
  description: "Crea una nueva hoja de metrado en un proyecto con nombre y unidad.",
  risk: "write",
  requiresProjectId: true,
  inputSchema: createTakeoffInput,
  execute: async (input, context) => {
    const sheet = await createMetradoSheet({
      userId: context.userId,
      name: input.name,
      projectId: input.projectId,
      requestedUnit: input.unit,
    });
    return { id: sheet.id, name: sheet.name, unit: sheet.unit, projectId: sheet.projectId };
  },
  summarizeResult: (result) => `Hoja de metrado "${result.name}" creada.`,
};

const importTakeoffInput = z.object({
  sourceSheetId: z.string().min(1),
  newName: z.string().min(3),
});

export const importTakeoffTool: AgentToolDefinition<
  z.infer<typeof importTakeoffInput>,
  Record<string, unknown>
> = {
  name: "importTakeoff",
  description: "Importa/duplica una hoja de metrado existente con un nuevo nombre.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: importTakeoffInput,
  execute: async (input, context) => {
    const duplicated = await duplicateMetradoSheet({
      sourceSheetId: input.sourceSheetId,
      userId: context.userId,
      requestedName: input.newName,
    });
    return { id: duplicated.id, name: duplicated.name, sourceSheetId: input.sourceSheetId };
  },
  summarizeResult: (result) => `Metrado importado: "${result.name}".`,
};

// ─── Export tools ─────────────────────────────────────────────────────────────

const exportPDFInput = z.object({ budgetId: z.string().min(1) });

export const exportPDFTool: AgentToolDefinition<
  z.infer<typeof exportPDFInput>,
  Record<string, unknown>
> = {
  name: "exportPDF",
  description: "Exporta un presupuesto a formato PDF con todas sus partidas, APUs, totales y cronograma.",
  risk: "export",
  requiresProjectId: false,
  inputSchema: exportPDFInput,
  execute: async (input, context) => {
    const budget = await getBudgetById(input.budgetId, context.userId);
    if (!budget) throw new Error(`Presupuesto "${input.budgetId}" no encontrado.`);
    const { createBudgetPdf: createBudgetPdfFn } = await import("@/lib/exports/pdf");
    const pdfBuffer = await createBudgetPdfFn({ budget } as Parameters<typeof createBudgetPdfFn>[0]);
    return { budgetId: input.budgetId, size: pdfBuffer.byteLength, format: "pdf" };
  },
  summarizeResult: (result) => `PDF exportado (${Math.round(result.size / 1024)} KB).`,
};

const exportExcelInput = z.object({ budgetId: z.string().min(1) });

export const exportExcelTool: AgentToolDefinition<
  z.infer<typeof exportExcelInput>,
  Record<string, unknown>
> = {
  name: "exportExcel",
  description: "Exporta un presupuesto a formato Excel (.xlsx) con partidas, APUs, insumos, cronograma y fórmula polinómica.",
  risk: "export",
  requiresProjectId: false,
  inputSchema: exportExcelInput,
  execute: async (input, context) => {
    const budget = await getBudgetById(input.budgetId, context.userId);
    if (!budget) throw new Error(`Presupuesto "${input.budgetId}" no encontrado.`);
    const buffer = await createBudgetWorkbook({ budget } as Parameters<typeof createBudgetWorkbook>[0]);
    return { budgetId: input.budgetId, size: buffer.byteLength, format: "xlsx" };
  },
  summarizeResult: (result) => `Excel exportado (${Math.round(result.size / 1024)} KB).`,
};

const exportS10Input = z.object({ budgetId: z.string().min(1) });

export const exportS10Tool: AgentToolDefinition<
  z.infer<typeof exportS10Input>,
  Record<string, unknown>
> = {
  name: "exportS10",
  description: "Exporta un presupuesto en formato S10 para entidades gubernamentales peruanas.",
  risk: "export",
  requiresProjectId: false,
  inputSchema: exportS10Input,
  execute: async (input, _context) => {
    return { budgetId: input.budgetId, message: "Exportación S10 delegada a fases posteriores.", pending: true };
  },
  summarizeResult: () => "Exportación S10 solicitada.",
};

const dashboardInput = z.object({ projectId: z.string().min(1) });

export const dashboardTool: AgentToolDefinition<
  z.infer<typeof dashboardInput>,
  Record<string, unknown>
> = {
  name: "dashboard",
  description: "Genera un resumen dashboard del proyecto: presupuestos activos, avance, costos, alertas.",
  risk: "read",
  requiresProjectId: true,
  inputSchema: dashboardInput,
  execute: async (input, _context) => {
    return { projectId: input.projectId, message: "Dashboard delegado a fases posteriores.", pending: true };
  },
  summarizeResult: () => "Dashboard generado.",
};

// ─── Tool arrays ─────────────────────────────────────────────────────────────

export const takeoffTools: AgentToolDefinition[] = [reviewTakeoffTool, createTakeoffTool, importTakeoffTool];
export const scheduleTools: AgentToolDefinition[] = [createScheduleTool, updateTaskTool, linkPredecessorTool, moveTaskTool, calculateCriticalPathTool];
export const reportTools: AgentToolDefinition[] = [exportReportTool, exportPDFTool, exportExcelTool, exportS10Tool, dashboardTool];
export const chapterTools: AgentToolDefinition[] = [createChapterTool, moveChapterTool, deleteChapterTool];

export const remainingTools: AgentToolDefinition[] = [
  ...takeoffTools,
  ...scheduleTools,
  ...reportTools,
  ...chapterTools,
];

/** Todas las herramientas agenticas registrables en el ToolRegistry (33 herramientas). */
export const allTools: AgentToolDefinition[] = [
  ...budgetTools,
  ...partidaTools,
  ...apuTools,
  ...insumoTools,
  ...projectTools,
  ...mcpBudgetTools,
  ...remainingTools,
];
