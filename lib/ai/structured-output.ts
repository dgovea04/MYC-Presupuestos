import { z } from "zod";
import type { AiAutocompleteStructuredData } from "@/lib/ai/types";

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

export function parseAutocompleteStructuredData(answer: string): AiAutocompleteStructuredData | null {
  try {
    const parsedJson: unknown = JSON.parse(extractJsonObjectFromText(answer));
    if (!isRecord(parsedJson) || parsedJson.requiresHumanReview !== true) return null;

    const suggestion = normalizeAutocompleteSuggestion(parsedJson.suggestion);
    if (!suggestion) return null;

    const alternatives = Array.isArray(parsedJson.alternatives)
      ? parsedJson.alternatives.map(normalizeAutocompleteSuggestion).filter((item): item is NonNullable<typeof item> => item !== null)
      : [];
    const normalized = {
      answer: readNonEmptyString(parsedJson.answer),
      input: readNonEmptyString(parsedJson.input),
      suggestion,
      alternatives,
      assumptions: readStringArray(parsedJson.assumptions),
      requiresHumanReview: true as const,
    };
    const result = aiAutocompleteStructuredSchema.safeParse(normalized);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function normalizeAutocompleteSuggestion(value: unknown) {
  if (!isRecord(value)) return null;
  const description = readNonEmptyString(value.description);
  const unit = readNonEmptyString(value.unit);
  if (!description || !unit) return null;

  return {
    ...(readNonEmptyString(value.id) ? { id: readNonEmptyString(value.id) } : {}),
    ...(readNonEmptyString(value.code) ? { code: readNonEmptyString(value.code) } : {}),
    description,
    unit,
    ...(readNonEmptyString(value.category) ? { category: readNonEmptyString(value.category) } : {}),
    ...(readNonEmptyString(value.apuId) ? { apuId: readNonEmptyString(value.apuId) } : {}),
    ...(readNonEmptyString(value.apuDescription) ? { apuDescription: readNonEmptyString(value.apuDescription) } : {}),
    matchType: value.matchType === "existing" ? "existing" as const : "new" as const,
    missingFields: readStringArray(value.missingFields),
  };
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
