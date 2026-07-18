import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const scheduleMocks = vi.hoisted(() => ({
  previewWorkScheduleBase: vi.fn(),
  generateWorkScheduleBase: vi.fn(),
  getMetradoSheetById: vi.fn(),
  listMetradoTemplates: vi.fn(),
  validateMetradoSheet: vi.fn(),
  hasBlockingMetradoIssues: vi.fn(),
  getWorkScheduleSection: vi.fn(),
  calculateWorkScheduleCriticalPath: vi.fn(),
  getBudgetById: vi.fn(),
  saveBudgetPatch: vi.fn(),
  saveWorkScheduleItem: vi.fn(),
  createMetradoSheet: vi.fn(),
  duplicateMetradoSheet: vi.fn(),
  createApuWorkbook: vi.fn(),
  createBudgetWorkbook: vi.fn(),
}));

vi.mock("@/lib/data/work-schedule", () => ({
  previewWorkScheduleBase: scheduleMocks.previewWorkScheduleBase,
  generateWorkScheduleBase: scheduleMocks.generateWorkScheduleBase,
  getWorkScheduleSection: scheduleMocks.getWorkScheduleSection,
  saveWorkScheduleItem: scheduleMocks.saveWorkScheduleItem,
}));

vi.mock("@/lib/data/metrados", () => ({
  getMetradoSheetById: scheduleMocks.getMetradoSheetById,
  listMetradoTemplates: scheduleMocks.listMetradoTemplates,
  createMetradoSheet: scheduleMocks.createMetradoSheet,
  duplicateMetradoSheet: scheduleMocks.duplicateMetradoSheet,
}));

vi.mock("@/lib/metrados/validation", () => ({
  validateMetradoSheet: scheduleMocks.validateMetradoSheet,
  hasBlockingMetradoIssues: scheduleMocks.hasBlockingMetradoIssues,
}));

vi.mock("@/lib/work-schedule/critical-path", () => ({
  calculateWorkScheduleCriticalPath: scheduleMocks.calculateWorkScheduleCriticalPath,
}));

vi.mock("@/lib/data/budgets", () => ({
  getBudgetById: scheduleMocks.getBudgetById,
  saveBudgetPatch: scheduleMocks.saveBudgetPatch,
}));

vi.mock("@/lib/exports/excel", () => ({
  createApuWorkbook: scheduleMocks.createApuWorkbook,
  createBudgetWorkbook: scheduleMocks.createBudgetWorkbook,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import {
  previewScheduleTool,
  reviewTakeoffTool,
  createScheduleTool,
  calculateCriticalPathTool,
} from "./index";
import type { AgentToolContext } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    userId: "user-1",
    executionId: "exec-schedule-1",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// previewScheduleTool
// ═══════════════════════════════════════════════════════════════════════════════

describe("previewScheduleTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tiene risk=read y NO requiere projectId", () => {
    expect(previewScheduleTool.risk).toBe("read");
    expect(previewScheduleTool.requiresProjectId).toBe(false);
  });

  it("llama previewWorkScheduleBase con los parámetros correctos", async () => {
    scheduleMocks.previewWorkScheduleBase.mockResolvedValue({
      budgetId: "budget-1",
      baseStartDate: "2026-01-15",
      totalItems: 50,
      scheduledItems: 45,
      unscheduledItems: 5,
      newItems: 45,
      issues: [],
      highlights: [],
      strategy: "sequential",
      timelineStartDate: "2026-01-15",
      timelineEndDate: "2026-06-20",
      canGenerate: true,
    });

    const result = await previewScheduleTool.execute(
      { budgetId: "budget-1", baseStartDate: "2026-01-15" },
      makeContext({ userId: "user-42" }),
    );

    expect(scheduleMocks.previewWorkScheduleBase).toHaveBeenCalledWith(
      "budget-1",
      "user-42",
      { baseStartDate: "2026-01-15" },
    );
    expect(result.budgetId).toBe("budget-1");
    expect(result.scheduledItems).toBe(45);
    expect(result.totalItems).toBe(50);
  });

  it("retorna canGenerate=true cuando hay partidas programadas", async () => {
    scheduleMocks.previewWorkScheduleBase.mockResolvedValue({
      budgetId: "budget-1",
      baseStartDate: "2026-01-15",
      totalItems: 10,
      scheduledItems: 8,
      unscheduledItems: 2,
      newItems: 8,
      issues: [],
      highlights: [],
      strategy: "sequential",
      timelineStartDate: "2026-01-15",
      timelineEndDate: "2026-03-01",
      canGenerate: true,
    });

    const result = await previewScheduleTool.execute(
      { budgetId: "budget-1", baseStartDate: "2026-01-15" },
      makeContext(),
    );

    expect(result.canGenerate).toBe(true);
  });

  it("retorna canGenerate=false cuando no hay partidas programadas", async () => {
    scheduleMocks.previewWorkScheduleBase.mockResolvedValue({
      budgetId: "budget-1",
      baseStartDate: "2026-01-15",
      totalItems: 5,
      scheduledItems: 0,
      unscheduledItems: 5,
      newItems: 0,
      issues: [],
      highlights: [],
      strategy: "sequential",
      timelineStartDate: null,
      timelineEndDate: null,
      canGenerate: false,
    });

    const result = await previewScheduleTool.execute(
      { budgetId: "budget-1", baseStartDate: "2026-01-15" },
      makeContext(),
    );

    expect(result.canGenerate).toBe(false);
    expect(result.scheduledItems).toBe(0);
  });

  it("propaga errores de previewWorkScheduleBase", async () => {
    scheduleMocks.previewWorkScheduleBase.mockRejectedValue(
      new Error("No tienes permisos para acceder a esta programacion de obra"),
    );

    await expect(
      previewScheduleTool.execute(
        { budgetId: "budget-inaccesible", baseStartDate: "2026-01-15" },
        makeContext(),
      ),
    ).rejects.toThrow("No tienes permisos");
  });

  // ─── summarizeResult ────────────────────────────────────────────────────

  it("summarizeResult muestra partidas programadas y estrategia", () => {
    const summary = previewScheduleTool.summarizeResult!({
      budgetId: "budget-1",
      baseStartDate: "2026-01-15",
      totalItems: 50,
      scheduledItems: 45,
      unscheduledItems: 5,
      newItems: 45,
      issues: [],
      highlights: [],
      strategy: "sequential",
      timelineStartDate: "2026-01-15",
      timelineEndDate: "2026-06-20",
      canGenerate: true,
    });

    expect(summary).toContain("45 partidas programadas");
    expect(summary).toContain("50 totales");
    expect(summary).toContain("sequential");
  });

  it("summarizeResult incluye rango de fechas cuando están disponibles", () => {
    const summary = previewScheduleTool.summarizeResult!({
      budgetId: "budget-1",
      baseStartDate: "2026-01-15",
      totalItems: 10,
      scheduledItems: 10,
      unscheduledItems: 0,
      newItems: 10,
      issues: [],
      highlights: [],
      strategy: "sequential",
      timelineStartDate: "2026-01-15",
      timelineEndDate: "2026-03-20",
      canGenerate: true,
    });

    expect(summary).toContain("2026-01-15");
    expect(summary).toContain("2026-03-20");
  });

  it("summarizeResult muestra advertencia cuando hay partidas no programadas", () => {
    const summary = previewScheduleTool.summarizeResult!({
      budgetId: "budget-1",
      baseStartDate: "2026-01-15",
      totalItems: 50,
      scheduledItems: 42,
      unscheduledItems: 8,
      newItems: 42,
      issues: [],
      highlights: [],
      strategy: "sequential",
      timelineStartDate: "2026-01-15",
      timelineEndDate: "2026-05-01",
      canGenerate: true,
    });

    expect(summary).toContain("no se pudieron programar");
    expect(summary).toContain("8");
  });

  it("summarizeResult muestra issues cuando existen", () => {
    const summary = previewScheduleTool.summarizeResult!({
      budgetId: "budget-1",
      baseStartDate: "2026-01-15",
      totalItems: 50,
      scheduledItems: 45,
      unscheduledItems: 5,
      newItems: 45,
      issues: [
        { budgetItemId: "item-1", itemCode: "01.01", reason: "Rendimiento por defecto" },
      ],
      highlights: [],
      strategy: "sequential",
      timelineStartDate: "2026-01-15",
      timelineEndDate: "2026-06-20",
      canGenerate: true,
    });

    expect(summary).toContain("Issues detectados");
    expect(summary).toContain("01.01");
    expect(summary).toContain("Rendimiento por defecto");
  });

  it("summarizeResult muestra highlights cuando existen", () => {
    const summary = previewScheduleTool.summarizeResult!({
      budgetId: "budget-1",
      baseStartDate: "2026-01-15",
      totalItems: 50,
      scheduledItems: 45,
      unscheduledItems: 5,
      newItems: 45,
      issues: [],
      highlights: ["3 partidas con cuadrilla ajustada", "Especialidades en paralelo"],
      strategy: "by_similarity",
      timelineStartDate: "2026-01-15",
      timelineEndDate: "2026-06-20",
      canGenerate: true,
    });

    expect(summary).toContain("cuadrilla ajustada");
    expect(summary).toContain("Especialidades en paralelo");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// reviewTakeoffTool
// ═══════════════════════════════════════════════════════════════════════════════

describe("reviewTakeoffTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tiene risk=read y NO requiere projectId", () => {
    expect(reviewTakeoffTool.risk).toBe("read");
    expect(reviewTakeoffTool.requiresProjectId).toBe(false);
  });

  it("lanza error cuando la hoja de metrado no existe", async () => {
    scheduleMocks.getMetradoSheetById.mockResolvedValue(null);

    await expect(
      reviewTakeoffTool.execute(
        { sheetId: "sheet-inexistente" },
        makeContext({ userId: "user-1" }),
      ),
    ).rejects.toThrow("no encontrada");
  });

  it("revisa una hoja de metrado limpia (sin errores ni advertencias)", async () => {
    scheduleMocks.getMetradoSheetById.mockResolvedValue({
      id: "sheet-1",
      name: "Metrado de concreto",
      status: "DRAFT",
      unit: "m2",
      totalQuantity: 120,
      projectId: "proj-1",
      budgetId: "budget-1",
      templateType: "CUSTOM",
      partidaLink: {
        budgetItemUnit: "m2",
      },
      rows: [
        { id: "row-1", sector: "A", eje: "1", nivel: "1", description: "Losa", unit: "m2", formulaKey: "manual", inputs: { manual: 10 }, partial: 10, sortOrder: 1 },
      ],
    });

    scheduleMocks.listMetradoTemplates.mockResolvedValue([]);

    scheduleMocks.validateMetradoSheet.mockReturnValue([]);
    scheduleMocks.hasBlockingMetradoIssues.mockReturnValue(false);

    const result = await reviewTakeoffTool.execute(
      { sheetId: "sheet-1" },
      makeContext({ userId: "user-1" }),
    );

    expect(result.sheetName).toBe("Metrado de concreto");
    expect(result.rowCount).toBe(1);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.hasErrors).toBe(false);
    expect(result.recommendation).toContain("lista para enviarse");
  });

  it("reporta errores cuando validateMetradoSheet encuentra issues bloqueantes", async () => {
    scheduleMocks.getMetradoSheetById.mockResolvedValue({
      id: "sheet-2",
      name: "Metrado con error",
      status: "DRAFT",
      unit: "m2",
      totalQuantity: 0,
      projectId: "proj-1",
      budgetId: "budget-1",
      templateType: "CUSTOM",
      partidaLink: null,
      rows: [],
    });

    scheduleMocks.listMetradoTemplates.mockResolvedValue([]);

    scheduleMocks.validateMetradoSheet.mockReturnValue([
      { id: "sheet-empty", severity: "error", message: "La hoja debe tener al menos una fila de metrado." },
    ]);
    scheduleMocks.hasBlockingMetradoIssues.mockReturnValue(true);

    const result = await reviewTakeoffTool.execute(
      { sheetId: "sheet-2" },
      makeContext(),
    );

    expect(result.hasErrors).toBe(true);
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(0);
    expect(result.issues[0].message).toContain("al menos una fila");
    expect(result.recommendation).toContain("corregirse antes de enviar");
  });

  it("reporta advertencias sin errores bloqueantes", async () => {
    scheduleMocks.getMetradoSheetById.mockResolvedValue({
      id: "sheet-3",
      name: "Metrado con advertencias",
      status: "DRAFT",
      unit: "m2",
      totalQuantity: 50,
      projectId: "proj-1",
      budgetId: "budget-1",
      templateType: "CUSTOM",
      partidaLink: { budgetItemUnit: "m2" },
      rows: [
        { id: "row-1", sector: "A", eje: "1", nivel: "1", description: "Losa", unit: "m2", formulaKey: "area", inputs: {}, partial: 50, sortOrder: 1 },
      ],
    });

    scheduleMocks.listMetradoTemplates.mockResolvedValue([
      {
        id: "tmpl-1",
        type: "CUSTOM",
        name: "Personalizado",
        description: "",
        defaultUnit: "m2",
        formulaKeys: ["manual", "area"],
        formulas: [],
      },
    ]);

    scheduleMocks.validateMetradoSheet.mockReturnValue([
      { id: "row-1-fields", severity: "warning", message: "Faltan campos requeridos" },
    ]);
    scheduleMocks.hasBlockingMetradoIssues.mockReturnValue(false);

    const result = await reviewTakeoffTool.execute(
      { sheetId: "sheet-3" },
      makeContext(),
    );

    expect(result.hasErrors).toBe(false);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(1);
    expect(result.issues[0].severity).toBe("warning");
    expect(result.recommendation).toContain("Revisa antes de enviar");
  });

  it("llama a getMetradoSheetById con el userId del contexto", async () => {
    scheduleMocks.getMetradoSheetById.mockResolvedValue(null);

    await expect(
      reviewTakeoffTool.execute(
        { sheetId: "sheet-x" },
        makeContext({ userId: "user-99" }),
      ),
    ).rejects.toThrow();

    expect(scheduleMocks.getMetradoSheetById).toHaveBeenCalledWith("sheet-x", "user-99");
  });

  it("busca la plantilla correspondiente para obtener formulaKeys", async () => {
    scheduleMocks.getMetradoSheetById.mockResolvedValue({
      id: "sheet-4",
      name: "Metrado concreto",
      status: "DRAFT",
      unit: "m3",
      totalQuantity: 200,
      projectId: "proj-1",
      budgetId: "budget-1",
      templateType: "CONCRETO",
      partidaLink: { budgetItemUnit: "m3" },
      rows: [
        { id: "row-1", sector: "A", eje: "1", nivel: "1", description: "Zapata", unit: "m3", formulaKey: "volumen", inputs: {}, partial: 10, sortOrder: 1 },
      ],
    });

    scheduleMocks.listMetradoTemplates.mockResolvedValue([
      {
        id: "tmpl-concreto",
        type: "CONCRETO",
        name: "Concreto",
        description: "Metrado de concreto",
        defaultUnit: "m3",
        formulaKeys: ["manual", "volumen", "area"],
        formulas: [],
      },
      {
        id: "tmpl-acero",
        type: "ACERO",
        name: "Acero",
        description: "Metrado de acero",
        defaultUnit: "kg",
        formulaKeys: ["manual", "peso", "longitud"],
        formulas: [],
      },
    ]);

    scheduleMocks.validateMetradoSheet.mockReturnValue([]);
    scheduleMocks.hasBlockingMetradoIssues.mockReturnValue(false);

    await reviewTakeoffTool.execute(
      { sheetId: "sheet-4" },
      makeContext(),
    );

    // Debe haber llamado a listMetradoTemplates para buscar la plantilla
    expect(scheduleMocks.listMetradoTemplates).toHaveBeenCalled();

    // Debe llamar a validateMetradoSheet con las formulaKeys de la plantilla CONCRETO
    expect(scheduleMocks.validateMetradoSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        templateFormulaKeys: ["manual", "volumen", "area"],
      }),
    );
  });

  it("usa ['manual'] como fallback cuando no encuentra la plantilla", async () => {
    scheduleMocks.getMetradoSheetById.mockResolvedValue({
      id: "sheet-5",
      name: "Metrado sin plantilla",
      status: "DRAFT",
      unit: "m2",
      totalQuantity: 10,
      projectId: "proj-1",
      budgetId: "budget-1",
      templateType: "CUSTOM",
      partidaLink: null,
      rows: [
        { id: "row-1", sector: "A", eje: "1", nivel: "1", description: "Area", unit: "m2", formulaKey: "manual", inputs: { manual: 5 }, partial: 5, sortOrder: 1 },
      ],
    });

    // listMetradoTemplates retorna plantillas que no coinciden con CUSTOM
    scheduleMocks.listMetradoTemplates.mockResolvedValue([]);

    scheduleMocks.validateMetradoSheet.mockReturnValue([]);
    scheduleMocks.hasBlockingMetradoIssues.mockReturnValue(false);

    await reviewTakeoffTool.execute(
      { sheetId: "sheet-5" },
      makeContext(),
    );

    expect(scheduleMocks.validateMetradoSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        templateFormulaKeys: ["manual"],
      }),
    );
  });

  it("reporta errores de fórmula cuando las formulaKeys no coinciden con la plantilla", async () => {
    scheduleMocks.getMetradoSheetById.mockResolvedValue({
      id: "sheet-6",
      name: "Metrado con fórmula inválida",
      status: "DRAFT",
      unit: "m2",
      totalQuantity: 20,
      projectId: "proj-1",
      budgetId: "budget-1",
      templateType: "CUSTOM",
      partidaLink: { budgetItemUnit: "m2" },
      rows: [
        { id: "row-1", sector: "A", eje: "1", nivel: "1", description: "Volumen", unit: "m2", formulaKey: "volumen", inputs: { largo: 2, ancho: 3 }, partial: 6, sortOrder: 1 },
      ],
    });

    // La plantilla solo tiene formulaKeys ["manual", "area"] — "volumen" NO está
    scheduleMocks.listMetradoTemplates.mockResolvedValue([
      {
        id: "tmpl-1",
        type: "CUSTOM",
        name: "Personalizado",
        description: "",
        defaultUnit: "m2",
        formulaKeys: ["manual", "area"],
        formulas: [],
      },
    ]);

    scheduleMocks.validateMetradoSheet.mockReturnValue([
      { id: "row-1-formula-unsupported", severity: "error", rowId: "row-1", field: "formulaKey", message: "La formula no pertenece a la plantilla seleccionada." },
    ]);
    scheduleMocks.hasBlockingMetradoIssues.mockReturnValue(true);

    const result = await reviewTakeoffTool.execute(
      { sheetId: "sheet-6" },
      makeContext(),
    );

    expect(result.hasErrors).toBe(true);
    expect(result.errorCount).toBe(1);
    expect(result.issues[0].message).toContain("no pertenece a la plantilla");
    expect(scheduleMocks.validateMetradoSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        templateFormulaKeys: ["manual", "area"],
      }),
    );
  });

  // ─── summarizeResult ────────────────────────────────────────────────────

  it("summarizeResult indica errores cuando hasErrors=true", () => {
    const summary = reviewTakeoffTool.summarizeResult!({
      sheetId: "sheet-1",
      sheetName: "Metrado con error",
      status: "DRAFT",
      totalQuantity: 0,
      rowCount: 0,
      errorCount: 2,
      warningCount: 0,
      hasErrors: true,
      issues: [],
      recommendation: "",
    });

    expect(summary).toContain("Metrado con error");
    expect(summary).toContain("2 errores");
    expect(summary).toContain("0 advertencias");
  });

  it("summarizeResult indica advertencias cuando no hay errores pero sí warnings", () => {
    const summary = reviewTakeoffTool.summarizeResult!({
      sheetId: "sheet-2",
      sheetName: "Metrado revisado",
      status: "DRAFT",
      totalQuantity: 100,
      rowCount: 5,
      errorCount: 0,
      warningCount: 3,
      hasErrors: false,
      issues: [],
      recommendation: "",
    });

    expect(summary).toContain("3 advertencias");
  });

  it('summarizeResult indica "Sin problemas" cuando no hay errores ni advertencias', () => {
    const summary = reviewTakeoffTool.summarizeResult!({
      sheetId: "sheet-3",
      sheetName: "Metrado limpio",
      status: "VALIDATED",
      totalQuantity: 120,
      rowCount: 10,
      errorCount: 0,
      warningCount: 0,
      hasErrors: false,
      issues: [],
      recommendation: "",
    });

    expect(summary).toContain("Sin problemas");
    expect(summary).toContain("10 filas");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createScheduleTool — modo incremental
// ═══════════════════════════════════════════════════════════════════════════════

describe("createScheduleTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tiene risk=write y NO requiere projectId", () => {
    expect(createScheduleTool.risk).toBe("write");
    expect(createScheduleTool.requiresProjectId).toBe(false);
  });

  it("el modo por defecto es 'full'", () => {
    const parsed = createScheduleTool.inputSchema.parse({
      budgetId: "budget-1",
      baseStartDate: "2026-01-15",
    });
    expect(parsed.mode).toBe("full");
  });

  it("acepta mode='incremental' explícitamente", () => {
    const parsed = createScheduleTool.inputSchema.parse({
      budgetId: "budget-1",
      baseStartDate: "2026-01-15",
      mode: "incremental",
    });
    expect(parsed.mode).toBe("incremental");
  });

  it("rechaza valores de mode inválidos", () => {
    expect(() =>
      createScheduleTool.inputSchema.parse({
        budgetId: "budget-1",
        baseStartDate: "2026-01-15",
        mode: "invalid",
      }),
    ).toThrow();
  });

  it("pasa mode='full' a generateWorkScheduleBase por defecto", async () => {
    scheduleMocks.generateWorkScheduleBase.mockResolvedValue({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      projectName: "Proyecto Test",
      currency: "PEN",
      timeline: { startDate: "2026-01-15", endDate: "2026-06-20" },
      groups: [],
      generationSummary: {
        generatedCount: 45,
        pendingCount: 5,
        totalItems: 50,
        scheduledItems: 45,
        unscheduledItems: 5,
        issues: [],
        appliedOptions: { strategy: "sequential" },
        highlights: [],
      },
    });

    await createScheduleTool.execute(
      { budgetId: "budget-1", baseStartDate: "2026-01-15", mode: "full" as const },
      makeContext({ userId: "user-1" }),
    );

    expect(scheduleMocks.generateWorkScheduleBase).toHaveBeenCalledWith(
      "budget-1",
      "user-1",
      expect.objectContaining({
        baseStartDate: "2026-01-15",
        mode: "full",
      }),
    );
  });

  it("pasa mode='incremental' a generateWorkScheduleBase", async () => {
    scheduleMocks.generateWorkScheduleBase.mockResolvedValue({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      projectName: "Proyecto Test",
      currency: "PEN",
      timeline: { startDate: "2026-01-15", endDate: "2026-06-20" },
      groups: [],
      generationSummary: {
        generatedCount: 10,
        pendingCount: 5,
        totalItems: 50,
        scheduledItems: 10,
        unscheduledItems: 5,
        issues: [],
        appliedOptions: { strategy: "sequential" },
        highlights: [],
      },
    });

    await createScheduleTool.execute(
      { budgetId: "budget-1", baseStartDate: "2026-01-15", mode: "incremental" },
      makeContext({ userId: "user-1" }),
    );

    expect(scheduleMocks.generateWorkScheduleBase).toHaveBeenCalledWith(
      "budget-1",
      "user-1",
      expect.objectContaining({
        baseStartDate: "2026-01-15",
        mode: "incremental",
      }),
    );
  });

  it("retorna el modo en el resultado", async () => {
    scheduleMocks.generateWorkScheduleBase.mockResolvedValue({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      projectName: "Proyecto Test",
      currency: "PEN",
      timeline: { startDate: "2026-01-15", endDate: "2026-03-01" },
      groups: [],
      generationSummary: {
        generatedCount: 5,
        pendingCount: 0,
        totalItems: 50,
        scheduledItems: 5,
        unscheduledItems: 0,
        issues: [],
        appliedOptions: { strategy: "sequential" },
        highlights: [],
      },
    });

    const result = await createScheduleTool.execute(
      { budgetId: "budget-1", baseStartDate: "2026-01-15", mode: "incremental" },
      makeContext(),
    );

    expect(result.mode).toBe("incremental");
  });

  // ─── summarizeResult ────────────────────────────────────────────────────

  it("summarizeResult muestra '(modo incremental)' cuando mode es incremental", () => {
    const summary = createScheduleTool.summarizeResult!({
      budgetId: "budget-1",
      baseStartDate: "2026-01-15",
      mode: "incremental",
      totalItems: 50,
      scheduledItems: 10,
      unscheduledItems: 5,
      timelineStartDate: "2026-01-15",
      timelineEndDate: "2026-03-01",
    });

    expect(summary).toContain("modo incremental");
    expect(summary).toContain("10 partidas programadas");
  });

  it("summarizeResult NO muestra 'modo incremental' cuando mode es full", () => {
    const summary = createScheduleTool.summarizeResult!({
      budgetId: "budget-1",
      baseStartDate: "2026-01-15",
      mode: "full",
      totalItems: 50,
      scheduledItems: 45,
      unscheduledItems: 5,
      timelineStartDate: "2026-01-15",
      timelineEndDate: "2026-06-20",
    });

    expect(summary).not.toContain("modo incremental");
    expect(summary).toContain("45 partidas programadas");
  });

  it("propaga errores de generateWorkScheduleBase", async () => {
    scheduleMocks.generateWorkScheduleBase.mockRejectedValue(
      new Error("No tienes permisos para acceder a esta programacion de obra"),
    );

    await expect(
      createScheduleTool.execute(
        { budgetId: "budget-inaccesible", baseStartDate: "2026-01-15" },
        makeContext(),
      ),
    ).rejects.toThrow("No tienes permisos");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// scheduleTools array
// ═══════════════════════════════════════════════════════════════════════════════

function makeCriticalPathFixture() {
  return [
    {
      budgetItemId: "item-1",
      itemCode: "01.01",
      durationDays: 5,
      predecessor: null,
    },
    {
      budgetItemId: "item-2",
      itemCode: "01.02",
      durationDays: 3,
      predecessor: "01.01FS",
    },
    {
      budgetItemId: "item-3",
      itemCode: "01.03",
      durationDays: 4,
      predecessor: "01.02FS",
    },
  ];
}

describe("calculateCriticalPathTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tiene risk=read y NO requiere projectId", () => {
    expect(calculateCriticalPathTool.risk).toBe("read");
    expect(calculateCriticalPathTool.requiresProjectId).toBe(false);
  });

  it("calcula ruta crítica y propaga el resultado de calculateWorkScheduleCriticalPath", async () => {
    const sectionLines = makeCriticalPathFixture();
    scheduleMocks.getWorkScheduleSection.mockResolvedValue({ lines: sectionLines });
    scheduleMocks.calculateWorkScheduleCriticalPath.mockReturnValue({
      status: "calculated",
      projectDurationDays: 12,
      itemsByBudgetItemId: new Map([
        [
          "item-1",
          {
            budgetItemId: "item-1",
            itemCode: "01.01",
            durationDays: 5,
            earlyStartDay: 0,
            earlyFinishDay: 4,
            lateStartDay: 0,
            lateFinishDay: 4,
            totalSlackDays: 0,
            isCritical: true,
          },
        ],
        [
          "item-2",
          {
            budgetItemId: "item-2",
            itemCode: "01.02",
            durationDays: 3,
            earlyStartDay: 5,
            earlyFinishDay: 7,
            lateStartDay: 5,
            lateFinishDay: 7,
            totalSlackDays: 0,
            isCritical: true,
          },
        ],
        [
          "item-3",
          {
            budgetItemId: "item-3",
            itemCode: "01.03",
            durationDays: 4,
            earlyStartDay: 8,
            earlyFinishDay: 11,
            lateStartDay: 8,
            lateFinishDay: 11,
            totalSlackDays: 0,
            isCritical: true,
          },
        ],
      ]),
      issues: [],
    });

    const result = await calculateCriticalPathTool.execute(
      { budgetId: "budget-1" },
      makeContext({ userId: "user-1" }),
    );

    expect(scheduleMocks.getWorkScheduleSection).toHaveBeenCalledWith("budget-1", "user-1");
    expect(result.budgetId).toBe("budget-1");
    expect(result.totalItems).toBe(3);
    expect(result.projectDurationDays).toBe(12);
    expect(result.criticalItemCount).toBe(3);
    expect(result.status).toBe("calculated");
  });

  it("regression catcher: pasa section.lines SIN transformar (predecessor singular, sin predecessors plural)", async () => {
    // Round 3 fix: si alguien reintroduce el `.map(l => ({ budgetItemId, durationDays: (l as ...).duration, startDate, endDate, predecessors: (l as ...).predecessors }))`
    // que vivía antes en calculateCriticalPathTool.execute, este test falla:
    // - el shape que recibe calculateWorkScheduleCriticalPath no tendría `predecessor` (singular) sino `predecessors` (plural);
    // - el `toEqual(sectionLines)` falla porque las lineas perderían los campos reales.
    // No eliminar las asserts de `toHaveProperty` + `not.toHaveProperty` aunque parezcan redundantes: son las que capturan el bug del plural.
    const sectionLines = makeCriticalPathFixture();
    scheduleMocks.getWorkScheduleSection.mockResolvedValue({ lines: sectionLines });
    scheduleMocks.calculateWorkScheduleCriticalPath.mockReturnValue({
      status: "calculated",
      projectDurationDays: 12,
      itemsByBudgetItemId: new Map<string, never>(),
      issues: [],
    });

    await calculateCriticalPathTool.execute({ budgetId: "budget-1" }, makeContext());

    const callArgs = scheduleMocks.calculateWorkScheduleCriticalPath.mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    expect(callArgs).toEqual(sectionLines);
    expect(callArgs).toHaveLength(3);
    expect(callArgs[0]).toMatchObject({ budgetItemId: "item-1", predecessor: null });
    expect(callArgs[1]).toMatchObject({ budgetItemId: "item-2", predecessor: "01.01FS" });
    expect(callArgs[2]).toMatchObject({ budgetItemId: "item-3", predecessor: "01.02FS" });
    for (const line of callArgs) {
      expect(line).toHaveProperty("predecessor");
      expect(line).not.toHaveProperty("predecessors");
    }
  });

  it("reporta status=cycle cuando calculateWorkScheduleCriticalPath detecta un ciclo", async () => {
    const sectionLines = makeCriticalPathFixture();
    scheduleMocks.getWorkScheduleSection.mockResolvedValue({ lines: sectionLines });
    scheduleMocks.calculateWorkScheduleCriticalPath.mockReturnValue({
      status: "cycle",
      projectDurationDays: 0,
      itemsByBudgetItemId: new Map<string, never>(),
      issues: ["El cronograma contiene un ciclo de predecesoras"],
    });

    const result = await calculateCriticalPathTool.execute({ budgetId: "budget-1" }, makeContext());

    expect(result.status).toBe("cycle");
    expect(result.projectDurationDays).toBe(0);
    expect(result.criticalItemCount).toBe(0);
  });

  it("summarizeResult reporta correctamente tareas críticas y duración", () => {
    const summary = calculateCriticalPathTool.summarizeResult!({
      budgetId: "budget-1",
      projectDurationDays: 12,
      criticalItemCount: 3,
      totalItems: 3,
      status: "calculated",
    });

    expect(summary).toContain("3 tareas críticas");
    expect(summary).toContain("12 días");
  });

  it("summarizeResult sigue funcionando cuando status es 'cycle'", () => {
    const summary = calculateCriticalPathTool.summarizeResult!({
      budgetId: "budget-1",
      projectDurationDays: 0,
      criticalItemCount: 0,
      totalItems: 3,
      status: "cycle",
    });

    expect(summary).toContain("0 tareas críticas");
    expect(summary).toContain("0 días");
  });
});

describe("scheduleTools array", () => {
  it("incluye previewScheduleTool como primera herramienta", async () => {
    const { scheduleTools } = await import("./index");
    expect(scheduleTools[0].name).toBe("previewSchedule");
  });

  it("incluye createScheduleTool", async () => {
    const { scheduleTools } = await import("./index");
    const names = scheduleTools.map((t) => t.name);
    expect(names).toContain("createSchedule");
  });

  it("incluye las 6 herramientas de cronograma", async () => {
    const { scheduleTools } = await import("./index");
    expect(scheduleTools).toHaveLength(6);
    const names = scheduleTools.map((t) => t.name);
    expect(names).toEqual([
      "previewSchedule",
      "createSchedule",
      "updateTask",
      "linkPredecessor",
      "moveTask",
      "calculateCriticalPath",
    ]);
  });
});
