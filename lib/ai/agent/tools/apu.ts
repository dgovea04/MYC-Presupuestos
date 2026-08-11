import { z } from "zod";
import crypto from "crypto";
import type { AgentToolDefinition } from "../types";
import { saveCatalogPartidasPatch, getCatalogPartidas } from "@/lib/data/partidas";

// ─── Input schemas ───────────────────────────────────────────────────────────

const reviewAPUInput = z.object({
  apuDescription: z.string().min(10).describe("Descripción del APU a revisar"),
  unit: z.string().optional().describe("Unidad de medida"),
});

const calculateAPUInput = z.object({
  description: z.string().min(3).describe("Descripción del APU"),
  unit: z.string().min(1).describe("Unidad de medida"),
  performance: z.number().positive().describe("Rendimiento (unidad/día)"),
  materials: z
    .array(
      z.object({
        description: z.string(),
        unit: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive().optional(),
      })
    )
    .optional()
    .describe("Lista de materiales"),
  labor: z
    .array(
      z.object({
        description: z.string(),
        unit: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive().optional(),
      })
    )
    .optional()
    .describe("Lista de mano de obra"),
  equipment: z
    .array(
      z.object({
        description: z.string(),
        unit: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive().optional(),
      })
    )
    .optional()
    .describe("Lista de equipos"),
});

// ─── Tool definitions ────────────────────────────────────────────────────────

export const reviewAPUTool: AgentToolDefinition<
  z.infer<typeof reviewAPUInput>,
  Record<string, unknown>
> = {
  name: "reviewAPU",
  description:
    "Revisa un análisis de precio unitario (APU) y detecta problemas de consistencia, precios atípicos, unidades inconsistentes y rendimientos fuera de rango.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: reviewAPUInput,
  execute: async (input, _context) => {
    // Stub: delegará a AI review service en fases posteriores
    return {
      apuDescription: input.apuDescription,
      findings: [],
      recommendation:
        "Revisión APU delegada. El análisis detallado estará disponible en fases posteriores.",
    };
  },
  summarizeResult: (result) =>
    `Revisión APU completada: ${(result.findings as unknown[]).length} hallazgos.`,
};

export const calculateAPUTool: AgentToolDefinition<
  z.infer<typeof calculateAPUInput>,
  Record<string, unknown>
> = {
  name: "calculateAPU",
  description:
    "Calcula el costo unitario de un APU dados materiales, mano de obra, equipos y rendimiento. Retorna el costo total y desglose por categoría.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: calculateAPUInput,
  execute: async (input, _context) => {
    const materialsCost = (input.materials ?? []).reduce(
      (sum, m) => sum + m.quantity * (m.unitPrice ?? 0),
      0
    );
    const laborCost = (input.labor ?? []).reduce(
      (sum, l) => sum + l.quantity * (l.unitPrice ?? 0),
      0
    );
    const equipmentCost = (input.equipment ?? []).reduce(
      (sum, e) => sum + e.quantity * (e.unitPrice ?? 0),
      0
    );
    const totalCost = materialsCost + laborCost + equipmentCost;
    const unitCost = totalCost / input.performance;

    return {
      description: input.description,
      unit: input.unit,
      performance: input.performance,
      materialsCost: Math.round(materialsCost * 100) / 100,
      laborCost: Math.round(laborCost * 100) / 100,
      equipmentCost: Math.round(equipmentCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      unitCost: Math.round(unitCost * 100) / 100,
      materialsCount: (input.materials ?? []).length,
      laborCount: (input.labor ?? []).length,
      equipmentCount: (input.equipment ?? []).length,
    };
  },
  summarizeResult: (result) =>
    `APU "${result.description}": costo unitario = ${result.unitCost} ${result.unit}`,
};

// ─── Additional APU tools ────────────────────────────────────────────────────

const createAPUInput = z.object({
  description: z.string().min(3).describe("Descripción de la partida APU"),
  unit: z.string().min(1).describe("Unidad de medida"),
  unitPrice: z.number().positive().describe("Precio unitario"),
  performance: z.number().positive().default(1).describe("Rendimiento"),
});

export const createAPUTool: AgentToolDefinition<
  z.infer<typeof createAPUInput>,
  Record<string, unknown>
> = {
  name: "createAPU",
  description: "Crea un nuevo análisis de precio unitario en el catálogo con descripción, unidad, precio y rendimiento.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: createAPUInput,
  execute: async (input, _context) => {
    const result = await saveCatalogPartidasPatch({
      create: [{
        clientId: crypto.randomUUID(),
        data: {
          description: input.description,
          unit: input.unit,
          unitPrice: input.unitPrice,
          currency: "PEN",
          performance: input.performance,
          apuRows: [],
        },
      }],
      update: [],
      delete: [],
    });
    const created = result.created[0]?.partida;
    if (!created) throw new Error("No se pudo crear el APU.");
    return { id: created.id, description: created.description, unit: created.unit, unitPrice: created.unitPrice, performance: input.performance };
  },
  summarizeResult: (result) => `APU "${result.description}" creado (${result.unit}, S/ ${result.unitPrice}).`,
};

const updateAPUInput = z.object({
  partidaId: z.string().min(1).describe("ID de la partida APU a actualizar"),
  description: z.string().optional(),
  unit: z.string().optional(),
  unitPrice: z.number().positive().optional(),
  performance: z.number().positive().optional(),
});

export const updateAPUTool: AgentToolDefinition<
  z.infer<typeof updateAPUInput>,
  Record<string, unknown>
> = {
  name: "updateAPU",
  description: "Actualiza datos de un APU existente: descripción, unidad, precio unitario o rendimiento.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: updateAPUInput,
  execute: async (input, _context) => {
    const all = await getCatalogPartidas();
    const existing = all.find((p) => p.id === input.partidaId);
    if (!existing) throw new Error(`APU "${input.partidaId}" no encontrado.`);
    const result = await saveCatalogPartidasPatch({
      create: [],
      update: [{
        id: existing.id,
        changes: {
          description: input.description ?? existing.description,
          unit: input.unit ?? existing.unit,
          unitPrice: input.unitPrice ?? existing.unitPrice,
          currency: "PEN",
          performance: input.performance ?? existing.performance,
          apuRows: existing.apuRows,
        },
      }],
      delete: [],
    });
    const updated = result.updated[0];
    return { id: input.partidaId, description: updated?.description, unit: updated?.unit, unitPrice: updated?.unitPrice };
  },
  summarizeResult: (result) => `APU "${result.description}" actualizado.`,
};

const generateAPUInput = z.object({
  description: z.string().min(10).describe("Descripción detallada de la partida para generar APU"),
  unit: z.string().min(1).describe("Unidad de medida"),
  projectId: z.string().optional(),
});

export const generateAPUTool: AgentToolDefinition<
  z.infer<typeof generateAPUInput>,
  Record<string, unknown>
> = {
  name: "generateAPU",
  description: "Genera un APU completo con materiales, mano de obra y equipos sugeridos a partir de una descripción técnica.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: generateAPUInput,
  execute: async (input, _context) => {
    return { description: input.description, unit: input.unit, message: "Generación de APU delegada a fases posteriores.", pending: true };
  },
  summarizeResult: (result) => `APU generado para "${result.description}".`,
};

const optimizeAPUInput = z.object({
  partidaId: z.string().min(1).describe("ID de la partida APU a optimizar"),
});

export const optimizeAPUTool: AgentToolDefinition<
  z.infer<typeof optimizeAPUInput>,
  Record<string, unknown>
> = {
  name: "optimizeAPU",
  description: "Analiza un APU y sugiere optimizaciones de costos: alternativas de insumos, ajustes de rendimiento, cuadrillas más eficientes.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: optimizeAPUInput,
  execute: async (input, _context) => {
    const all = await getCatalogPartidas();
    const partida = all.find((p) => p.id === input.partidaId);
    if (!partida) throw new Error(`APU "${input.partidaId}" no encontrado.`);
    return { partidaId: input.partidaId, currentCost: partida.unitPrice, resourceCount: partida.apuRows.length, suggestions: [], message: "Optimización delegada a fases posteriores." };
  },
  summarizeResult: (result) => `Optimización APU: ${(result.suggestions as unknown[]).length} sugerencias.`,
};

// ─── All APU tools ───────────────────────────────────────────────────────────

export const apuTools = [reviewAPUTool, calculateAPUTool, createAPUTool, updateAPUTool, generateAPUTool, optimizeAPUTool];
