import { z } from "zod";

const selectedSourceSchema = z.object({
  partidaId: z.string().min(1),
  score: z.coerce.number().min(0).max(1),
  isPrimary: z.boolean().optional(),
});

const generatedInsumoSchema = z.object({
  resourceId: z.string().nullable().optional(),
  description: z.string().min(1),
  unit: z.string().min(1),
  resourceType: z.string().nullable().optional(),
  suggestedQuantity: z.coerce.number().nonnegative(),
  finalQuantity: z.coerce.number().nonnegative(),
  unitPrice: z.coerce.number().nonnegative(),
  confidence: z.coerce.number().min(0).max(1),
  confidenceLevel: z.enum(["auto", "review", "optional"]),
  suggestedCrew: z.coerce.number().nonnegative().nullable().optional(),
  finalCrew: z.coerce.number().nonnegative().nullable().optional(),
  calculationMethod: z.literal("weighted_median"),
  sourcePartidaIds: z.array(z.string().min(1)).default([]),
  statistics: z.object({
    average: z.coerce.number().nonnegative(),
    median: z.coerce.number().nonnegative(),
    minimum: z.coerce.number().nonnegative(),
    maximum: z.coerce.number().nonnegative(),
    standardDeviation: z.coerce.number().nonnegative(),
  }),
});

export const partidaGenerationSearchSchema = z.object({
  sourceText: z.string().min(3),
  unit: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const partidaGenerationAggregateSchema = z.object({
  selectedSources: z.array(selectedSourceSchema).min(1),
});

export const partidaGenerationSaveSchema = z.object({
  sourceText: z.string().min(3),
  generatedName: z.string().min(3),
  unit: z.string().min(1),
  performance: z.coerce.number().positive(),
  similarityScore: z.coerce.number().min(0).max(1),
  selectedSources: z.array(selectedSourceSchema).min(1),
  insumos: z.array(generatedInsumoSchema),
}).superRefine((input, context) => {
  const primaryCount = input.selectedSources.filter((source) => source.isPrimary).length;

  if (primaryCount > 1) {
    context.addIssue({
      code: "custom",
      message: "Solo una partida fuente puede ser principal",
      path: ["selectedSources"],
    });
  }

  input.insumos.forEach((insumo, index) => {
    if (!insumo.resourceId && insumo.unitPrice > 0) {
      context.addIssue({
        code: "custom",
        message: "Los precios deben salir del catalogo de insumos",
        path: ["insumos", index, "unitPrice"],
      });
    }
  });
});

export type PartidaGenerationSearchInput = z.infer<typeof partidaGenerationSearchSchema>;
export type PartidaGenerationAggregateInput = z.infer<typeof partidaGenerationAggregateSchema>;
export type PartidaGenerationSaveInput = z.infer<typeof partidaGenerationSaveSchema>;
