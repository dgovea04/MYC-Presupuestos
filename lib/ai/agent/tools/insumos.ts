import { z } from "zod";
import type { AgentToolDefinition } from "../types";
import { getResourcesByUser, createResourceForUser, updateResource, deleteResource } from "@/lib/data/resources";

// ─── Input schemas ───────────────────────────────────────────────────────────

const searchInsumosInput = z.object({
  query: z.string().min(1).optional().describe("Descripción o código del insumo a buscar (opcional, lista todos si se omite)"),
  category: z
    .enum(["MATERIAL", "LABOR", "EQUIPMENT", "TOOLS", "SUBCONTRACT"])
    .optional()
    .describe("Categoría del insumo"),
});

const addInsumoInput = z.object({
  description: z.string().min(3).describe("Descripción del insumo"),
  unit: z.string().min(1).describe("Unidad de medida"),
  category: z
    .enum(["MATERIAL", "LABOR", "EQUIPMENT", "TOOLS", "SUBCONTRACT"])
    .describe("Categoría del insumo"),
  unitPrice: z.number().nonnegative().describe("Precio unitario"),
  code: z.string().optional().describe("Código opcional del insumo"),
});

// ─── Tool definitions ────────────────────────────────────────────────────────

export const searchInsumosTool: AgentToolDefinition<
  z.infer<typeof searchInsumosInput>,
  Record<string, unknown>
> = {
  name: "searchInsumos",
  description:
    "Busca insumos (materiales, mano de obra, equipos, herramientas, subcontratos) en el catálogo por descripción o código.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: searchInsumosInput,
  execute: async (input, context) => {
    const effectiveQuery = input.query ?? "";
    const resources = await getResourcesByUser(context.userId);
    const lowerQuery = effectiveQuery.toLowerCase();
    const matches = resources
      .filter((r) => {
        const descMatch = r.description.toLowerCase().includes(lowerQuery);
        const codeMatch = r.code.toLowerCase().includes(lowerQuery);
        const catMatch = !input.category || r.category === input.category;
        return (descMatch || codeMatch) && catMatch;
      })
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        code: r.code,
        description: r.description,
        unit: r.unit,
        category: r.category,
        unitPrice: r.unitPrice,
      }));

    return {
      query: effectiveQuery,
      matchCount: matches.length,
      insumos: matches,
    };
  },
  summarizeResult: (result) =>
    `${result.matchCount} insumos encontrados para "${result.query}".`,
};

export const addInsumoTool: AgentToolDefinition<
  z.infer<typeof addInsumoInput>,
  Record<string, unknown>
> = {
  name: "addInsumo",
  description:
    "Agrega un nuevo insumo al catálogo con descripción, unidad, categoría y precio unitario. Requiere aprobación previa.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: addInsumoInput,
  execute: async (input, context) => {
    const resource = await createResourceForUser(context.userId, {
      description: input.description,
      unit: input.unit,
      category: input.category,
      unitPrice: input.unitPrice,
      currency: "PEN",
      code: input.code ?? null,
    });

    return {
      id: resource.id,
      code: resource.code,
      description: resource.description,
      unit: resource.unit,
      category: resource.category,
      unitPrice: resource.unitPrice,
    };
  },
  summarizeResult: (result) =>
    `Insumo "${result.description}" creado (${result.code}, ${result.category}).`,
};

// ─── Additional insumo tools ─────────────────────────────────────────────────

const replaceInsumoInput = z.object({
  sourceInsumoId: z.string().min(1).describe("ID del insumo a reemplazar"),
  targetInsumoId: z.string().min(1).describe("ID del nuevo insumo que reemplaza"),
});

export const replaceInsumoTool: AgentToolDefinition<
  z.infer<typeof replaceInsumoInput>,
  Record<string, unknown>
> = {
  name: "replaceInsumo",
  description: "Reemplaza un insumo por otro en el catálogo. Útil para actualizar referencias a un insumo obsoleto.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: replaceInsumoInput,
  execute: async (input, context) => {
    const resources = await getResourcesByUser(context.userId);
    const source = resources.find((r) => r.id === input.sourceInsumoId);
    const target = resources.find((r) => r.id === input.targetInsumoId);
    if (!source) throw new Error(`Insumo fuente "${input.sourceInsumoId}" no encontrado.`);
    if (!target) throw new Error(`Insumo destino "${input.targetInsumoId}" no encontrado.`);
    // Soft replacement: delete source, keep target
    await deleteResource(input.sourceInsumoId, context.userId);
    return { replacedId: input.sourceInsumoId, replacementId: input.targetInsumoId, replacementDescription: target.description };
  },
  summarizeResult: (result) => `Insumo reemplazado por "${result.replacementDescription}".`,
};

const updatePrecioInput = z.object({
  insumoId: z.string().min(1).describe("ID del insumo"),
  newUnitPrice: z.number().nonnegative().describe("Nuevo precio unitario"),
  reason: z.string().optional().describe("Razón del cambio de precio"),
});

export const updatePrecioTool: AgentToolDefinition<
  z.infer<typeof updatePrecioInput>,
  Record<string, unknown>
> = {
  name: "updatePrecio",
  description: "Actualiza el precio unitario de un insumo con razón del cambio.",
  risk: "financial",
  requiresProjectId: false,
  inputSchema: updatePrecioInput,
  execute: async (input, context) => {
    const resources = await getResourcesByUser(context.userId);
    const resource = resources.find((r) => r.id === input.insumoId);
    if (!resource) throw new Error(`Insumo "${input.insumoId}" no encontrado.`);
    await updateResource(input.insumoId, context.userId, {
      description: resource.description,
      unit: resource.unit,
      category: resource.category as "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS" | "SUBCONTRACT",
      unitPrice: input.newUnitPrice,
      currency: "PEN",
      code: resource.code,
    });
    return { insumoId: input.insumoId, oldPrice: resource.unitPrice, newPrice: input.newUnitPrice, reason: input.reason };
  },
  summarizeResult: (result) => `Precio actualizado: S/ ${result.oldPrice} → S/ ${result.newPrice}.`,
};

// ─── All insumo tools ────────────────────────────────────────────────────────

export const insumoTools: AgentToolDefinition[] = [searchInsumosTool, addInsumoTool, replaceInsumoTool, updatePrecioTool];
