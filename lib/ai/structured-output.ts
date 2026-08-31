import { z } from "zod";

const aiLineItemSchema = z.object({
  description: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  quantity: z.string().trim().min(1),
  notes: z.string().trim().min(1).optional(),
});

const aiAutocompletePartidaSuggestionSchema = z.object({
  id: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  category: z.string().trim().min(1).optional(),
  apuId: z.string().trim().min(1).optional(),
  apuDescription: z.string().trim().min(1).optional(),
  matchType: z.enum(["existing", "new"]),
  missingFields: z.array(z.string().trim().min(1)),
});

export const aiAutocompleteStructuredSchema = z.object({
  answer: z.string().trim().min(1),
  input: z.string().trim().min(1),
  suggestion: aiAutocompletePartidaSuggestionSchema,
  alternatives: z.array(aiAutocompletePartidaSuggestionSchema),
  assumptions: z.array(z.string().trim().min(1)),
  requiresHumanReview: z.literal(true),
});

export const aiApuStructuredSchema = z.object({
  answer: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  performance: z.string().trim().min(1),
  crew: z.string().trim().min(1),
  materials: z.array(aiLineItemSchema),
  labor: z.array(aiLineItemSchema),
  equipment: z.array(aiLineItemSchema),
  observations: z.array(z.string().trim().min(1)),
  assumptions: z.array(z.string().trim().min(1)),
});

export const aiApuCatalogProposalSchema = z.object({
  partida_name: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  based_on_partida_id: z.string().trim().min(1).optional(),
  confidence: z.number().min(0).max(1),
  items: z.array(
    z.object({
      resource_id: z.string().trim().min(1),
      name: z.string().trim().min(1),
      type: z.enum(["MATERIAL", "LABOR", "EQUIPMENT", "TOOLS"]),
      unit: z.string().trim().min(1),
      quantity: z.number().nonnegative(),
      source: z.literal("catalog"),
      requires_review: z.boolean(),
    }),
  ),
  suggested_new_resources: z.array(
    z.object({
      type: z.literal("suggested_new_resource"),
      reason: z.string().trim().min(1),
      based_on: z.string().trim().min(1),
    }),
  ),
  warnings: z.array(z.string().trim().min(1)),
  requires_human_review: z.boolean(),
});

export const aiReviewStructuredSchema = z.object({
  answer: z.string().trim().min(1),
  findings: z.array(
    z.object({
      severity: z.enum(["low", "medium", "high"]),
      type: z.enum(["duplicate", "unit", "cost", "quantity", "consistency", "other"]),
      description: z.string().trim().min(1),
      impact: z.string().trim().min(1),
      recommendedAction: z.string().trim().min(1),
    }),
  ),
  assumptions: z.array(z.string().trim().min(1)),
});

export function extractJsonObjectFromText(answer: string) {
  const startIndex = answer.indexOf("{");
  const endIndex = answer.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("La IA no devolvio un JSON estructurado valido.");
  }

  return answer.slice(startIndex, endIndex + 1);
}

export function parseStructuredAiOutput<TSchema extends z.ZodType>({
  answer,
  schema,
}: {
  answer: string;
  schema: TSchema;
}) {
  const jsonCandidate = extractJsonObjectFromText(answer);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonCandidate);
  } catch {
    throw new Error("La IA no devolvio un JSON estructurado valido.");
  }

  const data = schema.parse(parsedJson);

  return {
    answer: readStructuredAnswer(data, jsonCandidate),
    data,
  };
}

function readStructuredAnswer(data: unknown, fallback: string) {
  if (typeof data === "object" && data !== null && "answer" in data && typeof data.answer === "string") {
    return data.answer;
  }

  if (typeof data === "object" && data !== null && "partida_name" in data && typeof data.partida_name === "string") {
    return data.partida_name;
  }

  return fallback;
}
