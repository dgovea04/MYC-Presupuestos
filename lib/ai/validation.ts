import { z } from "zod";

const aiContextSchema = z.object({
  project: z.string().trim().min(1).optional(),
  module: z.string().trim().min(1).optional(),
  selectedItem: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).optional(),
  currentCost: z.coerce.number().nonnegative().optional(),
  activeTable: z.string().trim().min(1).optional(),
});

export const aiChatRequestSchema = z.object({
  message: z.string().trim().min(1, "Ingresa una consulta para la IA."),
  context: aiContextSchema.optional(),
});

export const aiApuRequestSchema = z.object({
  description: z.string().trim().min(3, "Ingresa la descripcion de la partida."),
  unit: z.string().trim().min(1).optional(),
  context: aiContextSchema.optional(),
});

export const aiApuCatalogGenerateRequestSchema = z.object({
  query: z.string().trim().min(3, "Ingresa la descripcion de la partida."),
  unit: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  project_type: z.string().trim().min(1).optional(),
  context: aiContextSchema.optional(),
});

export const aiReviewRequestSchema = z.object({
  budgetSummary: z.string().trim().min(10, "Ingresa informacion suficiente para revisar el presupuesto."),
  context: aiContextSchema.optional(),
});

export const aiAutocompleteRequestSchema = z.object({
  input: z.string().trim().min(3, "Ingresa un texto base para autocompletar."),
  context: aiContextSchema.optional(),
});
