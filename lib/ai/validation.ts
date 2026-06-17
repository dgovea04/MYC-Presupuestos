import { z } from "zod";

const aiContextSchema = z.object({
  project: z.string().trim().min(1).optional(),
  module: z.string().trim().min(1).optional(),
  selectedItem: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).optional(),
  currentCost: z.coerce.number().nonnegative().optional(),
  activeTable: z.string().trim().min(1).optional(),
});

const projectIdSchema = z.string().trim().min(1).optional();

export const aiProviderSchema = z.enum(["auto", "ollama", "chatgpt_bridge", "openai", "gemini", "openrouter"]);

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
  context: aiContextSchema.optional(),
  projectId: projectIdSchema,
});

export const aiApuRequestSchema = z.object({
  description: z.string().trim().min(3, "Ingresa la descripcion de la partida."),
  provider: aiProviderSchema.default("auto"),
  unit: z.string().trim().min(1).optional(),
  context: aiContextSchema.optional(),
  projectId: projectIdSchema,
});

export const aiApuCatalogGenerateRequestSchema = z.object({
  query: z.string().trim().min(3, "Ingresa la descripcion de la partida."),
  unit: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  project_type: z.string().trim().min(1).optional(),
  context: aiContextSchema.optional(),
  projectId: projectIdSchema,
});

export const aiReviewRequestSchema = z.object({
  budgetSummary: z.string().trim().min(10, "Ingresa informacion suficiente para revisar el presupuesto."),
  provider: aiProviderSchema.default("auto"),
  context: aiContextSchema.optional(),
  projectId: projectIdSchema,
});

export const aiAutocompleteRequestSchema = z.object({
  input: z.string().trim().min(3, "Ingresa un texto base para autocompletar."),
  provider: aiProviderSchema.default("auto"),
  context: aiContextSchema.optional(),
  projectId: projectIdSchema,
});

export const aiExecuteRequestSchema = z.object({
  provider: aiProviderSchema.default("auto"),
  task: khipuAiTaskSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  projectId: projectIdSchema,
});
