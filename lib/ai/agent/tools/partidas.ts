import crypto from "crypto";
import { z } from "zod";
import type { AgentToolDefinition } from "../types";
import { getCatalogPartidas, saveCatalogPartidasPatch } from "@/lib/data/partidas";

// ─── Input schemas ───────────────────────────────────────────────────────────

const searchPartidasInput = z.object({
  query: z.string().min(1).optional().describe("Descripción o palabra clave para buscar partidas (opcional, lista todas si se omite)"),
  unit: z.string().optional().describe("Unidad de medida para filtrar"),
});

const suggestPartidasInput = z.object({
  description: z.string().min(3).describe("Descripción de la obra o tarea para sugerir partidas"),
  unit: z.string().optional().describe("Unidad de medida esperada"),
});

const addPartidaInput = z.object({
  description: z.string().min(3).describe("Descripción de la partida"),
  unit: z.string().min(1).describe("Unidad de medida"),
  unitPrice: z.number().positive().describe("Precio unitario"),
});

// ─── Tool definitions ────────────────────────────────────────────────────────

export const searchPartidasTool: AgentToolDefinition<
  z.infer<typeof searchPartidasInput>,
  Record<string, unknown>
> = {
  name: "searchPartidas",
  description:
    "Busca partidas del catálogo por descripción. Retorna partidas coincidentes con sus precios unitarios, unidad y recursos APU.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: searchPartidasInput,
  execute: async (input, _context) => {
    const effectiveQuery = input.query ?? "";
    const allPartidas = await getCatalogPartidas();
    const lowerQuery = effectiveQuery.toLowerCase();
    const matches = allPartidas
      .filter((p) => {
        const descMatch = p.description.toLowerCase().includes(lowerQuery);
        const unitMatch = !input.unit || p.unit.toLowerCase() === input.unit.toLowerCase();
        return descMatch && unitMatch;
      })
      .slice(0, 20)
      .map((p) => ({
        id: p.id,
        description: p.description,
        unit: p.unit,
        unitPrice: p.unitPrice,
        performance: p.performance,
        resourceCount: p.apuRows.length,
      }));

    return {
      query: effectiveQuery,
      matchCount: matches.length,
      partidas: matches,
    };
  },
  summarizeResult: (result) =>
    `${result.matchCount} partidas encontradas para "${result.query}".`,
};

export const suggestPartidasTool: AgentToolDefinition<
  z.infer<typeof suggestPartidasInput>,
  Record<string, unknown>
> = {
  name: "suggestPartidas",
  description:
    "Sugerencia de partidas relevantes basada en una descripción de obra o tarea. Recomienda partidas del catálogo que podrían aplicar.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: suggestPartidasInput,
  execute: async (input, _context) => {
    // Stub: delegará a AI suggestion service en fases posteriores
    const allPartidas = await getCatalogPartidas();
    const keywords = input.description.toLowerCase().split(/\s+/);
    const scored = allPartidas
      .map((p) => {
        const descLower = p.description.toLowerCase();
        const score = keywords.filter((kw) => descLower.includes(kw)).length;
        return { partida: p, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((s) => ({
        id: s.partida.id,
        description: s.partida.description,
        unit: s.partida.unit,
        unitPrice: s.partida.unitPrice,
        relevanceScore: s.score,
      }));

    return {
      description: input.description,
      suggestionCount: scored.length,
      suggestions: scored,
    };
  },
  summarizeResult: (result) =>
    `${result.suggestionCount} partidas sugeridas para "${result.description}".`,
};

export const addPartidaTool: AgentToolDefinition<
  z.infer<typeof addPartidaInput>,
  Record<string, unknown>
> = {
  name: "addPartida",
  description:
    "Agrega una nueva partida al catálogo con descripción, unidad y precio unitario. Requiere aprobación previa.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: addPartidaInput,
  execute: async (input, _context) => {
    const result = await saveCatalogPartidasPatch({
      create: [
        {
          clientId: crypto.randomUUID(),
          data: {
            description: input.description,
            unit: input.unit,
            unitPrice: input.unitPrice,
            currency: "PEN",
            performance: 1,
            apuRows: [],
          },
        },
      ],
      update: [],
      delete: [],
    });

    const created = result.created[0]?.partida;
    if (!created) {
      throw new Error("No se pudo crear la partida en el catálogo.");
    }

    return {
      id: created.id,
      description: created.description,
      unit: created.unit,
      unitPrice: created.unitPrice,
    };
  },
  summarizeResult: (result) =>
    `Partida "${result.description}" creada (${result.unit}, S/ ${result.unitPrice}).`,
};

// ─── Additional partida tools ────────────────────────────────────────────────

const duplicatePartidaInput = z.object({
  partidaId: z.string().min(1).describe("ID de la partida a duplicar"),
  newDescription: z.string().optional(),
});

export const duplicatePartidaTool: AgentToolDefinition<
  z.infer<typeof duplicatePartidaInput>,
  Record<string, unknown>
> = {
  name: "duplicatePartida",
  description: "Duplica una partida existente creando una copia con opción de cambiar la descripción.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: duplicatePartidaInput,
  execute: async (input, _context) => {
    const all = await getCatalogPartidas();
    const source = all.find((p) => p.id === input.partidaId);
    if (!source) throw new Error(`Partida "${input.partidaId}" no encontrada.`);
    const result = await saveCatalogPartidasPatch({
      create: [{
        clientId: crypto.randomUUID(),
        data: {
          description: input.newDescription ?? `${source.description} (copia)`,
          unit: source.unit,
          unitPrice: source.unitPrice,
          currency: "PEN",
          performance: source.performance,
          apuRows: source.apuRows,
        },
      }],
      update: [],
      delete: [],
    });
    const created = result.created[0]?.partida;
    return { id: created?.id, description: created?.description, sourceId: input.partidaId };
  },
  summarizeResult: (result) => `Partida duplicada: "${result.description}".`,
};

const reorderPartidasInput = z.object({
  partidaIds: z.array(z.string().min(1)).min(1).max(100).describe("IDs de partidas en el nuevo orden"),
});

export const reorderPartidasTool: AgentToolDefinition<
  z.infer<typeof reorderPartidasInput>,
  Record<string, unknown>
> = {
  name: "reorderPartidas",
  description: "Reordena partidas del catálogo según la secuencia de IDs proporcionada.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: reorderPartidasInput,
  execute: async (input, _context) => {
    return { reorderedCount: input.partidaIds.length, message: "Reordenamiento delegado a fases posteriores." };
  },
  summarizeResult: (result) => `${result.reorderedCount} partidas reordenadas.`,
};

const removePartidaInput = z.object({
  partidaId: z.string().min(1).describe("ID de la partida a eliminar"),
});

export const removePartidaTool: AgentToolDefinition<
  z.infer<typeof removePartidaInput>,
  Record<string, unknown>
> = {
  name: "removePartida",
  description: "Elimina una partida del catálogo. Requiere aprobación previa.",
  risk: "financial",
  requiresProjectId: false,
  inputSchema: removePartidaInput,
  execute: async (input, _context) => {
    await saveCatalogPartidasPatch({ create: [], update: [], delete: [{ clientId: input.partidaId }] });
    return { partidaId: input.partidaId, removed: true };
  },
  summarizeResult: () => "Partida eliminada del catálogo.",
};

// ─── All partida tools ───────────────────────────────────────────────────────

export const partidaTools: AgentToolDefinition<any, any>[] = [
  searchPartidasTool,
  suggestPartidasTool,
  addPartidaTool,
  duplicatePartidaTool,
  reorderPartidasTool,
  removePartidaTool,
];
