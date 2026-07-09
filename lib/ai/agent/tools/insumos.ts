import { z } from "zod";
import type { AgentToolDefinition } from "../types";
import { getResourcesByUser, createResourceForUser } from "@/lib/data/resources";

// ─── Input schemas ───────────────────────────────────────────────────────────

const searchInsumosInput = z.object({
  query: z.string().min(1).describe("Descripción o código del insumo a buscar"),
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
    const resources = await getResourcesByUser(context.userId);
    const lowerQuery = input.query.toLowerCase();
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
      query: input.query,
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

// ─── All insumo tools ────────────────────────────────────────────────────────

export const insumoTools: AgentToolDefinition[] = [searchInsumosTool, addInsumoTool];
