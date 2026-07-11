import { extractPartidaVariables } from "@/lib/partida-generation/variables";
import { jaccardSimilarity, normalizePartidaText, normalizeUnit, uniqueTokens } from "@/lib/partida-generation/text";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { PartidaTechnicalVariables, SimilarPartidaResult, SimilarityBreakdown } from "@/types/partida-generation";

type SearchSimilarPartidasInput = {
  query: string;
  unit?: string | null;
  partidas: CatalogPartidaRecord[];
  referenceResourceNames?: string[];
  limit?: number;
};

const WEIGHTS: SimilarityBreakdown = {
  element: 0.3,
  technical: 0.25,
  material: 0.2,
  unit: 0.1,
  category: 0.1,
  text: 0.05,
};

export function searchSimilarPartidas(input: SearchSimilarPartidasInput): SimilarPartidaResult[] {
  const queryVariables = extractPartidaVariables(input.query, input.unit);
  const referenceResourceTokens = new Set((input.referenceResourceNames ?? []).map(normalizePartidaText));

  return input.partidas
    .map((partida) => {
      const variables = extractPartidaVariables(partida.description, partida.unit);
      const breakdown = calculateSimilarityBreakdown(queryVariables, variables);
      const score = roundScore(computeAdaptiveScore(breakdown, queryVariables, variables));
      const compositionSimilarity = calculateCompositionSimilarity(partida, referenceResourceTokens);

      return {
        partida,
        score,
        compositionSimilarity,
        breakdown,
        variables,
      };
    })
    .sort((left, right) => {
      const scoreComparison = right.score - left.score;
      if (scoreComparison !== 0) return scoreComparison;

      const compositionComparison = right.compositionSimilarity - left.compositionSimilarity;
      if (compositionComparison !== 0) return compositionComparison;

      return left.partida.description.localeCompare(right.partida.description);
    })
    .slice(0, input.limit ?? 10);
}

function calculateSimilarityBreakdown(query: PartidaTechnicalVariables, candidate: PartidaTechnicalVariables): SimilarityBreakdown {
  return {
    element: elementSimilarity(query.element, candidate.element),
    technical: technicalSimilarity(query, candidate),
    material: exactFieldSimilarity(query.material, candidate.material),
    unit: exactFieldSimilarity(query.unit, candidate.unit),
    category: exactFieldSimilarity(query.category, candidate.category),
    text: jaccardSimilarity(query.keywords, candidate.keywords),
  };
}

const RELATED_STRUCTURAL_ELEMENTS = new Set(["columnas", "placas", "vigas", "losas"]);

function elementSimilarity(left: string | null, right: string | null) {
  if (!left && !right) return 0;
  if (!left || !right) return 0;
  if (left === right) return 1;
  return RELATED_STRUCTURAL_ELEMENTS.has(left) && RELATED_STRUCTURAL_ELEMENTS.has(right) ? 0.45 : 0;
}

function exactFieldSimilarity(left: string | null, right: string | null) {
  if (!left && !right) return 0;
  if (!left || !right) return 0;
  return left === right ? 1 : 0;
}

function technicalSimilarity(query: PartidaTechnicalVariables, candidate: PartidaTechnicalVariables) {
  if (query.resistance || candidate.resistance) {
    return query.resistance && candidate.resistance && query.resistance === candidate.resistance ? 1 : 0;
  }

  return jaccardSimilarity(query.technicalSpecs, candidate.technicalSpecs);
}

function calculateCompositionSimilarity(partida: CatalogPartidaRecord, referenceResourceTokens: Set<string>) {
  if (referenceResourceTokens.size === 0) return 0;

  const candidateTokens = new Set(partida.apuRows.map((row) => normalizePartidaText(row.description)));
  if (candidateTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of referenceResourceTokens) {
    if (candidateTokens.has(token)) {
      intersection += 1;
    }
  }

  return roundScore(intersection / new Set([...referenceResourceTokens, ...candidateTokens]).size);
}

function roundScore(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

/**
 * Computes a weighted similarity score with adaptive weight redistribution.
 *
 * When both query and candidate lack extracted metadata for a component
 * (both values are null/empty), that component is marked "absent" and its
 * weight is excluded from the total. The remaining valid weights are
 * proportionally redistributed, so the score only reflects available evidence.
 *
 * This prevents artificially low scores when the variable extractor can't
 * find structured data (element, material, category) for either item.
 */
export function computeAdaptiveScore(
  breakdown: SimilarityBreakdown,
  query: PartidaTechnicalVariables,
  candidate: PartidaTechnicalVariables,
): number {
  const isAbsent: Record<keyof SimilarityBreakdown, boolean> = {
    element: !query.element && !candidate.element,
    technical:
      !query.resistance &&
      !candidate.resistance &&
      !query.technicalSpecs.length &&
      !candidate.technicalSpecs.length,
    material: !query.material && !candidate.material,
    unit: !query.unit && !candidate.unit,
    category: !query.category && !candidate.category,
    text: !query.keywords.length && !candidate.keywords.length,
  };

  let validWeightTotal = 0;
  let rawScore = 0;

  for (const key of Object.keys(WEIGHTS) as Array<keyof SimilarityBreakdown>) {
    if (!isAbsent[key]) {
      validWeightTotal += WEIGHTS[key];
      rawScore += breakdown[key] * WEIGHTS[key];
    }
  }

  return validWeightTotal === 0 ? 0 : rawScore / validWeightTotal;
}

export function buildPartidaSearchTokens(value: string) {
  return uniqueTokens(value);
}

export function normalizePartidaUnitForSimilarity(value: string | null | undefined) {
  return normalizeUnit(value);
}
