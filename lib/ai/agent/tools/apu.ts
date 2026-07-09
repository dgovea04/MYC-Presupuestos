import { z } from "zod";
import type { AgentToolDefinition } from "../types";

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

// ─── All APU tools ───────────────────────────────────────────────────────────

export const apuTools: AgentToolDefinition[] = [reviewAPUTool, calculateAPUTool];
