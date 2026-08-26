import { z } from "zod";

const aiContextSchema = z.object({
  route: z.string().trim().min(1).optional(),
  projectId: z.string().trim().min(1).optional(),
  budgetId: z.string().trim().min(1).optional(),
  project: z.string().trim().min(1).optional(),
  module: z.string().trim().min(1).optional(),
  selectedItem: z.string().trim().min(1).optional(),
  selectionType: z.enum(["project", "budget", "partida", "resource", "metrado"]).optional(),
  selectionId: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).optional(),
  currentCost: z.coerce.number().nonnegative().optional(),
  activeTable: z.string().trim().min(1).optional(),
  viewSummary: z.string().trim().min(1).optional(),
});

const projectIdSchema = z.string().trim().min(1).optional();

export const aiProviderSchema = z.enum(["auto", "ollama", "chatgpt_bridge", "openai", "gemini", "openrouter", "agent"]);

export const khipuAiTaskSchema = z.enum([
  "review_apu",
  "generate_apu",
  "suggest_insumos",
  "review_budget",
  "generate_partida",
  "review_formula_polinomica",
  "review_quantity_takeoff",
  "montecarlo_risk_analysis",
  "chat",
  "autocomplete",
]);

export const aiChatRequestSchema = z.object({
  message: z.string().trim().min(1, "Ingresa una consulta para la IA."),
  provider: aiProviderSchema.default("auto"),
  modelPreference: z.string().optional(),
  context: aiContextSchema.optional(),
  projectId: projectIdSchema,
  workspaceId: z.string().trim().min(1).optional(),
  requestId: z.string().trim().min(1).max(200).optional(),
});

export const aiApuRequestSchema = z.object({
  description: z.string().trim().min(3, "Ingresa la descripcion de la partida."),
  provider: aiProviderSchema.default("auto"),
  unit: z.string().trim().min(1).optional(),
  context: aiContextSchema.optional(),
  projectId: projectIdSchema,
  requestId: z.string().trim().min(1).max(200).optional(),
});

export const aiApuCatalogGenerateRequestSchema = z.object({
  query: z.string().trim().min(3, "Ingresa la descripcion de la partida."),
  unit: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  project_type: z.string().trim().min(1).optional(),
  context: aiContextSchema.optional(),
  projectId: projectIdSchema,
  requestId: z.string().trim().min(1).max(200).optional(),
});

export const aiReviewRequestSchema = z.object({
  budgetSummary: z.string().trim().min(10, "Ingresa informacion suficiente para revisar el presupuesto."),
  provider: aiProviderSchema.default("auto"),
  context: aiContextSchema.optional(),
  projectId: projectIdSchema,
  requestId: z.string().trim().min(1).max(200).optional(),
});

const aiEndpointResultSchema = z.object({
  answer: z.string().trim().min(1, "La respuesta de IA no puede estar vacia."),
  model: z.string().trim().min(1, "El modelo es obligatorio."),
  requestedModel: z.string().trim().min(1, "El modelo solicitado es obligatorio."),
  fallbackUsed: z.boolean(),
  warnings: z.array(z.string()).default([]),
  latencyMs: z.number().finite().nonnegative().optional(),
  structuredData: z.unknown().optional(),
  provider: z.enum(["ollama", "chatgpt_bridge", "openai", "gemini", "openrouter", "agent"]).optional(),
  task: khipuAiTaskSchema.optional(),
  promptHash: z.string().trim().min(1).optional(),
  responseHash: z.string().trim().min(1).optional(),
});

export const aiBridgeReviewPersistRequestSchema = z.object({
  budgetSummary: z.string().trim().min(10, "Ingresa informacion suficiente para revisar el presupuesto."),
  context: aiContextSchema.optional(),
  projectId: projectIdSchema,
  result: aiEndpointResultSchema,
});

export const aiAutocompleteRequestSchema = z.object({
  input: z.string().trim().min(3, "Ingresa un texto base para autocompletar."),
  provider: aiProviderSchema.default("auto"),
  context: aiContextSchema.optional(),
  projectId: projectIdSchema,
  requestId: z.string().trim().min(1).max(200).optional(),
});

export const aiExecuteRequestSchema = z.object({
  provider: aiProviderSchema.default("auto"),
  task: khipuAiTaskSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  projectId: projectIdSchema,
  requestId: z.string().trim().min(1).max(200).optional(),
});
