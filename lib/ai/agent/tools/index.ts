import crypto from "crypto";
import { z } from "zod";
import type { AgentToolDefinition } from "../types";
import { getBudgetById, saveBudgetPatch } from "@/lib/data/budgets";
import { generateWorkScheduleBase, previewWorkScheduleBase, saveWorkScheduleItemPatch } from "@/lib/data/work-schedule";
import { getWorkScheduleSection } from "@/lib/data/work-schedule";
import { createMetradoSheet, duplicateMetradoSheet, getMetradoSheetById, listMetradoTemplates } from "@/lib/data/metrados";
import { validateMetradoSheet, hasBlockingMetradoIssues } from "@/lib/metrados/validation";
import { calculateWorkScheduleCriticalPath } from "@/lib/work-schedule/critical-path";
import { createApuWorkbook, createBudgetWorkbook } from "@/lib/exports/excel";
import { prisma } from "@/lib/db/prisma";
import type { WorkScheduleItemPatchInput } from "@/lib/validations/work-schedule";

import { budgetTools } from "./budgets";
import { partidaTools } from "./partidas";
import { apuTools } from "./apu";
import { insumoTools } from "./insumos";
import { projectTools } from "./projects";
import { mcpBudgetTools } from "./mcp-budget";
import { riskTools } from "./risk";

function asRegistrableTool(tool: unknown): AgentToolDefinition {
  return tool as unknown as AgentToolDefinition;
}

// Re-export all domain tools for single-point registration
export { budgetTools, partidaTools, apuTools, insumoTools, projectTools, mcpBudgetTools, riskTools };

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
  execute: async (input, context) => {
    const [sheet, templates] = await Promise.all([
      getMetradoSheetById(input.sheetId, context.userId),
      listMetradoTemplates(),
    ]);
    if (!sheet) {
      throw new Error(`Hoja de metrado "${input.sheetId}" no encontrada o no tienes acceso.`);
    }

    const matchingTemplate = templates.find((t) => t.type === sheet.templateType);
    const templateFormulaKeys = matchingTemplate?.formulaKeys ?? ["manual"];
    const issues = validateMetradoSheet({
      sheetUnit: sheet.unit,
      templateFormulaKeys,
      linkedPartidaUnit: sheet.partidaLink?.budgetItemUnit ?? null,
      rows: sheet.rows,
    });

    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");
    const hasErrors = hasBlockingMetradoIssues(issues);

    return {
      sheetId: input.sheetId,
      sheetName: sheet.name,
      status: sheet.status,
      totalQuantity: sheet.totalQuantity,
      rowCount: sheet.rows.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      hasErrors,
      issues: issues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        message: issue.message,
        rowId: "rowId" in issue && typeof issue.rowId === "string" ? issue.rowId : null,
        field: "field" in issue && typeof issue.field === "string" ? issue.field : null,
      })),
      recommendation: hasErrors
        ? "La hoja tiene errores que deben corregirse antes de enviar el metrado a la partida."
        : warnings.length > 0
          ? "La hoja tiene advertencias. Revisa antes de enviar a la partida."
          : "La hoja de metrado está lista para enviarse a la partida.",
    };
  },
  summarizeResult: (result) => {
    const hasErrors = Boolean(result.hasErrors);
    const errorCount = typeof result.errorCount === "number" ? result.errorCount : 0;
    const warningCount = typeof result.warningCount === "number" ? result.warningCount : 0;
    const sheetName = typeof result.sheetName === "string" ? result.sheetName : "hoja";
    const rowCount = typeof result.rowCount === "number" ? result.rowCount : 0;
    const status = hasErrors
      ? `${errorCount} errores, ${warningCount} advertencias`
      : warningCount > 0
        ? `${warningCount} advertencias`
        : "Sin problemas";
    return `Revisión de "${sheetName}": ${rowCount} filas, ${status}.`;
  },
};

// ─── Schedule (Cronograma) ────────────────────────────────────────────────────

const createScheduleInput = z.object({
  budgetId: z.string().min(1).describe("ID del presupuesto para generar cronograma"),
  baseStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Fecha de inicio base (YYYY-MM-DD)"),
  mode: z.enum(["full", "incremental"]).default("full").describe("Modo: 'full' regenera todo el cronograma, 'incremental' solo agrega partidas nuevas sin borrar las existentes"),
});

// ─── Preview Schedule ────────────────────────────────────────────────────────

const previewScheduleInput = z.object({
  budgetId: z.string().min(1).describe("ID del presupuesto para previsualizar cronograma"),
  baseStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Fecha de inicio base (YYYY-MM-DD)"),
});

export const previewScheduleTool: AgentToolDefinition<
  z.infer<typeof previewScheduleInput>,
  Record<string, unknown>
> = {
  name: "previewSchedule",
  description:
    "Genera una vista previa del cronograma que se crearía, mostrando cuántas partidas se programarían, " +
    "fechas estimadas, issues detectados (rendimientos sospechosos, partidas sin programar) y la estrategia a usar. " +
    "Solo lectura — NO escribe en la base de datos. " +
    "Usa esto ANTES de createSchedule para revisar qué se va a generar y pedir confirmación al usuario.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: previewScheduleInput,
  execute: async (input, context) => {
    const result = await previewWorkScheduleBase(input.budgetId, context.userId, {
      baseStartDate: input.baseStartDate,
    });
    return result;
  },
  summarizeResult: (result) => {
    const scheduledItems = typeof result.scheduledItems === "number" ? result.scheduledItems : 0;
    const totalItems = typeof result.totalItems === "number" ? result.totalItems : 0;
    const unscheduledItems = typeof result.unscheduledItems === "number" ? result.unscheduledItems : 0;
    const timelineStartDate =
      typeof result.timelineStartDate === "string" ? result.timelineStartDate : null;
    const timelineEndDate =
      typeof result.timelineEndDate === "string" ? result.timelineEndDate : null;
    const strategy = typeof result.strategy === "string" ? result.strategy : "sequential";
    const highlights = Array.isArray(result.highlights)
      ? (result.highlights as unknown[]).filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [];
    const issues: Array<{ budgetItemId: string; itemCode: string; reason: string }> =
      Array.isArray(result.issues)
        ? (result.issues as unknown[]).filter(
            (entry): entry is { budgetItemId: string; itemCode: string; reason: string } =>
              typeof entry === "object" &&
              entry !== null &&
              typeof (entry as { budgetItemId?: unknown }).budgetItemId === "string" &&
              typeof (entry as { itemCode?: unknown }).itemCode === "string" &&
              typeof (entry as { reason?: unknown }).reason === "string",
          )
        : [];

    const parts = [`📋 Vista previa del cronograma`];
    parts.push(`\n📊 ${scheduledItems} partidas programadas de ${totalItems} totales.`);
    if (unscheduledItems > 0) {
      parts.push(`⚠️ ${unscheduledItems} partidas no se pudieron programar (revisar issues).`);
    }
    if (timelineStartDate && timelineEndDate) {
      parts.push(`📅 Rango: ${timelineStartDate} → ${timelineEndDate}`);
    }
    parts.push(`🔧 Estrategia: ${strategy}`);
    if (highlights.length > 0) {
      parts.push(`\n✨ ${highlights.join("\n")}`);
    }
    if (issues.length > 0) {
      parts.push("\n⚠️ Issues detectados:");
      issues.forEach((issue) => {
        parts.push(`  • ${issue.itemCode}: ${issue.reason}`);
      });
    }
    return parts.join("\n");
  },
};

export const createScheduleTool: AgentToolDefinition<
  z.infer<typeof createScheduleInput>,
  Record<string, unknown>
> = {
  name: "createSchedule",
  description:
    "Crea o regenera un cronograma de obra para un presupuesto basado en rendimientos, cantidades y precedencias configuradas. " +
    "Usa mode='incremental' para solo agregar partidas nuevas sin borrar las existentes (preserva ajustes manuales).",
  risk: "write",
  requiresProjectId: false,
  inputSchema: createScheduleInput,
  execute: async (input, context) => {
    const result = await generateWorkScheduleBase(input.budgetId, context.userId, {
      baseStartDate: input.baseStartDate,
      mode: input.mode,
    });

    return {
      budgetId: input.budgetId,
      baseStartDate: input.baseStartDate,
      mode: input.mode,
      totalItems:
        (result.generationSummary?.generatedCount ?? 0) +
        (result.generationSummary?.pendingCount ?? 0),
      scheduledItems: result.generationSummary?.generatedCount ?? 0,
      unscheduledItems: result.generationSummary?.pendingCount ?? 0,
      timelineStartDate: result.timeline?.startDate ?? null,
      timelineEndDate: result.timeline?.endDate ?? null,
    };
  },
  summarizeResult: (result) => {
    const scheduledItems = typeof result.scheduledItems === "number" ? result.scheduledItems : 0;
    const totalItems = typeof result.totalItems === "number" ? result.totalItems : 0;
    const modeSuffix = result.mode === "incremental" ? " (modo incremental)" : "";
    return `Cronograma generado: ${scheduledItems} partidas programadas de ${totalItems} totales${modeSuffix}.`;
  },
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
  summarizeResult: (result) => {
    const format = typeof result.format === "string" ? result.format : "?";
    const budgetId = typeof result.budgetId === "string" ? result.budgetId : "?";
    return `Exportación a ${format} solicitada para presupuesto ${budgetId}.`;
  },
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
      budget: {},
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
  summarizeResult: (result) => {
    const name = typeof result.name === "string" ? result.name : "capítulo";
    const code = typeof result.code === "string" ? result.code : "?";
    const budgetId = typeof result.budgetId === "string" ? result.budgetId : "?";
    return `Capítulo "${name}" (${code}) creado en presupuesto ${budgetId}.`;
  },
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
      budget: {},
      levels: {
        create: [],
        update: [{ id: input.chapterId, changes: { sortOrder: input.newSortOrder } }],
        delete: [],
      },
      items: { create: [], update: [], delete: [] },
    });
    return { chapterId: input.chapterId, newSortOrder: input.newSortOrder };
  },
  summarizeResult: (result) => {
    const chapterId = typeof result.chapterId === "string" ? result.chapterId : "?";
    const newSortOrder = typeof result.newSortOrder === "number" ? result.newSortOrder : 0;
    return `Capítulo ${chapterId} movido a posición ${newSortOrder}.`;
  },
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
      budget: {},
      levels: { create: [], update: [], delete: [input.chapterId] },
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
    const patch: WorkScheduleItemPatchInput = { budgetItemId: input.itemId };
    if (input.duration != null) patch.durationDays = input.duration;
    if (input.startDate != null) patch.startDate = input.startDate;
    await saveWorkScheduleItemPatch(input.budgetId, context.userId, patch);
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
    // Autorizacion upfront (defensa-en-profundidad): valida que el usuario tiene
    // acceso al budget destino antes de tocar la BD. Patron consistente con
    // updateTask/deleteTask/otras tools de este archivo.
    const budget = await getBudgetById(input.budgetId, context.userId);
    if (!budget) {
      throw new Error(`Presupuesto "${input.budgetId}" no encontrado o no tienes acceso.`);
    }
    // Cross-budget predecessor lookup: budget.items solo contiene items del mismo SUB_BUDGET,
    // pero las dependencias pueden cruzar sub-budgets del mismo proyecto (tipico
    // Estructuras -> Arquitectura). Scoped a proyecto via budget.project.budgets.some
    // para garantizar que la predecesora pertenece al MISMO proyecto (no cruza
    // company/project boundaries) y respeta la membresia tenant del usuario.
    const predecessor = await prisma.budgetItem.findFirst({
      where: {
        id: input.predecessorItemId,
        budget: {
          project: {
            budgets: { some: { id: input.budgetId } },
            company: {
              memberships: { some: { userId: context.userId, status: "ACTIVE" } },
            },
          },
        },
      },
      select: { code: true, id: true },
    });
    if (!predecessor) {
      throw new Error(
        `La predecesora "${input.predecessorItemId}" no existe, no pertenece a este proyecto o no tienes acceso.`,
      );
    }
    await saveWorkScheduleItemPatch(input.budgetId, context.userId, {
      budgetItemId: input.itemId,
      predecessor: `${predecessor.code}${input.type}`,
    });
    return { itemId: input.itemId, predecessorId: input.predecessorItemId, type: input.type };
  },
  summarizeResult: (result) => {
    const type = typeof result.type === "string" ? result.type : "FS";
    const predecessorId =
      typeof result.predecessorId === "string" ? result.predecessorId : "?";
    const itemId = typeof result.itemId === "string" ? result.itemId : "?";
    return `Dependencia ${type} creada: ${predecessorId} → ${itemId}.`;
  },
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
    await saveWorkScheduleItemPatch(input.budgetId, context.userId, {
      budgetItemId: input.itemId,
      startDate: input.startDate,
    });
    return { itemId: input.itemId, newStartDate: input.startDate };
  },
  summarizeResult: (result) => {
    const itemId = typeof result.itemId === "string" ? result.itemId : "?";
    const newStartDate = typeof result.newStartDate === "string" ? result.newStartDate : "?";
    return `Tarea ${itemId} movida a ${newStartDate}.`;
  },
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
    const lines = section.groups.flatMap((group) => group.lines);
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
  summarizeResult: (result) => {
    const criticalItemCount =
      typeof result.criticalItemCount === "number" ? result.criticalItemCount : 0;
    const projectDurationDays =
      typeof result.projectDurationDays === "number" ? result.projectDurationDays : 0;
    return `Ruta crítica: ${criticalItemCount} tareas críticas, duración ${projectDurationDays} días.`;
  },
};

// ─── Takeoff (Metrados) management tools ──────────────────────────────────────

const createTakeoffInput = z.object({
  name: z.string().min(3),
  projectId: z.string().min(1),
  budgetId: z.string().min(1),
  budgetItemId: z.string().min(1),
  templateType: z
    .enum(["CONCRETE", "REBAR", "FORMWORK", "MASONRY", "PLASTER", "PAINT", "EXCAVATION", "FLOORING", "ROOFING", "CUSTOM"])
    .default("CUSTOM"),
  unit: z.enum(["m", "m2", "m3", "kg", "und", "glb", "p2", "ml", "mes"]).default("m2"),
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
      budgetId: input.budgetId,
      budgetItemId: input.budgetItemId,
      templateType: input.templateType,
      unit: input.unit,
    });
    return { id: sheet.id, name: sheet.name, unit: sheet.unit, projectId: sheet.projectId };
  },
  summarizeResult: (result) => {
    const name = typeof result.name === "string" ? result.name : "hoja";
    return `Hoja de metrado "${name}" creada.`;
  },
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
      name: input.newName,
    });
    return { id: duplicated.id, name: duplicated.name, sourceSheetId: input.sourceSheetId };
  },
  summarizeResult: (result) => {
    const name = typeof result.name === "string" ? result.name : "metrado";
    return `Metrado importado: "${name}".`;
  },
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
    const pdfBuffer = await createBudgetPdfFn(budget);
    return { budgetId: input.budgetId, size: pdfBuffer.byteLength, format: "pdf" };
  },
  summarizeResult: (result) => {
    const sizeKb = typeof result.size === "number" ? Math.round(result.size / 1024) : 0;
    return `PDF exportado (${sizeKb} KB).`;
  },
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
    const buffer = await createBudgetWorkbook(budget);
    return { budgetId: input.budgetId, size: buffer.byteLength, format: "xlsx" };
  },
  summarizeResult: (result) => {
    const sizeKb = typeof result.size === "number" ? Math.round(result.size / 1024) : 0;
    return `Excel exportado (${sizeKb} KB).`;
  },
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

export const takeoffTools = [reviewTakeoffTool, createTakeoffTool, importTakeoffTool];
export const scheduleTools = [previewScheduleTool, createScheduleTool, updateTaskTool, linkPredecessorTool, moveTaskTool, calculateCriticalPathTool];
export const reportTools = [exportReportTool, exportPDFTool, exportExcelTool, exportS10Tool, dashboardTool];
export const chapterTools = [createChapterTool, moveChapterTool, deleteChapterTool];

export const remainingTools = [
  ...takeoffTools,
  ...scheduleTools,
  ...reportTools,
  ...chapterTools,
];

/** Todas las herramientas agenticas registrables en el ToolRegistry (33 herramientas). */
const rawTools: readonly unknown[] = [
  ...budgetTools,
  ...partidaTools,
  ...apuTools,
  ...insumoTools,
  ...projectTools,
  ...mcpBudgetTools,
  ...riskTools,
  ...remainingTools,
];

export const allTools: AgentToolDefinition[] = rawTools.map(asRegistrableTool);
