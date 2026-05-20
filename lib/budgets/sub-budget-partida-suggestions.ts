import type { BudgetItemRecord } from "@/types/budget";
import type { CatalogPartidaRecord } from "@/types/partida";

export type BudgetPasteSuggestionConfidence = "high" | "medium" | "low";
export type BudgetPasteMatchKind = "exact" | "suggested" | "unresolved";

export type BudgetPasteSuggestedMatch = {
  partida: CatalogPartidaRecord;
  score: number;
  confidence: BudgetPasteSuggestionConfidence;
  reasonCodes: string[];
};

export type SuggestPartidaMatchesResult = {
  exactMatch: CatalogPartidaRecord | null;
  bestSuggestion: CatalogPartidaRecord | null;
  suggestions: BudgetPasteSuggestedMatch[];
  matchKind: BudgetPasteMatchKind;
};

type SuggestPartidaMatchesInput = {
  item: Pick<BudgetItemRecord, "description" | "unit" | "code">;
  catalog: CatalogPartidaRecord[];
  limit?: number;
};

const MIN_DESCRIPTION_LENGTH = 5;
const MIN_PRIMARY_SCORE = 0.55;

export function suggestPartidaMatches({
  item,
  catalog,
  limit = 3,
}: SuggestPartidaMatchesInput): SuggestPartidaMatchesResult {
  const normalizedDescription = normalizeBudgetLookupText(item.description);
  const normalizedUnit = normalizeBudgetLookupText(item.unit);

  if (isAmbiguousDescription(normalizedDescription)) {
    return {
      exactMatch: null,
      bestSuggestion: null,
      suggestions: [],
      matchKind: "unresolved",
    };
  }

  const exactDescriptionMatches = catalog.filter(
    (partida) => normalizeBudgetLookupText(partida.description) === normalizedDescription,
  );

  if (normalizedUnit) {
    const exactDescriptionAndUnitMatch =
      exactDescriptionMatches.find((partida) => normalizeBudgetLookupText(partida.unit) === normalizedUnit) ?? null;

    if (exactDescriptionAndUnitMatch) {
      const exactSuggestion = buildSuggestion(exactDescriptionAndUnitMatch, 1, "high", [
        "description-exact",
        "unit-match",
      ]);

      return {
        exactMatch: exactDescriptionAndUnitMatch,
        bestSuggestion: exactDescriptionAndUnitMatch,
        suggestions: [exactSuggestion],
        matchKind: "exact",
      };
    }
  }

  if (!normalizedUnit && exactDescriptionMatches.length === 1) {
    const onlyCandidate = exactDescriptionMatches[0] ?? null;

    if (onlyCandidate) {
      return {
        exactMatch: onlyCandidate,
        bestSuggestion: onlyCandidate,
        suggestions: [buildSuggestion(onlyCandidate, 0.97, "high", ["description-exact"])],
        matchKind: "exact",
      };
    }
  }

  const suggestions = catalog
    .map((partida) => scoreCatalogPartida(partida, normalizedDescription, normalizedUnit))
    .filter((suggestion): suggestion is BudgetPasteSuggestedMatch => suggestion !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  const bestSuggestion = suggestions[0]?.partida ?? null;
  const primarySuggestion = suggestions[0] ?? null;

  if (!primarySuggestion || primarySuggestion.score < MIN_PRIMARY_SCORE) {
    return {
      exactMatch: null,
      bestSuggestion: null,
      suggestions: [],
      matchKind: "unresolved",
    };
  }

  return {
    exactMatch: null,
    bestSuggestion,
    suggestions,
    matchKind: "suggested",
  };
}

export function normalizeBudgetLookupText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function scoreCatalogPartida(
  partida: CatalogPartidaRecord,
  normalizedDescription: string,
  normalizedUnit: string,
): BudgetPasteSuggestedMatch | null {
  const partidaDescription = normalizeBudgetLookupText(partida.description);
  const partidaUnit = normalizeBudgetLookupText(partida.unit);

  if (!partidaDescription) return null;

  const descriptionTokens = tokenize(normalizedDescription);
  const partidaTokens = tokenize(partidaDescription);
  const sharedTokens = descriptionTokens.filter((token) => partidaTokens.includes(token));
  const tokenCoverage =
    descriptionTokens.length > 0 ? sharedTokens.length / Math.max(descriptionTokens.length, partidaTokens.length) : 0;
  const containsEitherWay =
    partidaDescription.includes(normalizedDescription) || normalizedDescription.includes(partidaDescription);
  const prefixBonus = partidaDescription.startsWith(normalizedDescription) || normalizedDescription.startsWith(partidaDescription) ? 0.08 : 0;
  const containsBonus = containsEitherWay ? 0.18 : 0;
  const unitBonus = normalizedUnit && partidaUnit === normalizedUnit ? 0.22 : 0;
  const unitPenalty = normalizedUnit && partidaUnit !== normalizedUnit ? 0.18 : 0;
  const lengthPenalty = Math.abs(partidaDescription.length - normalizedDescription.length) > 24 ? 0.06 : 0;
  const baseScore = tokenCoverage + containsBonus + prefixBonus + unitBonus - unitPenalty - lengthPenalty;

  if (sharedTokens.length === 0 && !containsEitherWay) {
    return null;
  }

  if (baseScore < 0.2) {
    return null;
  }

  const confidence = resolveConfidence(baseScore, normalizedUnit && partidaUnit === normalizedUnit);
  const reasonCodes = sharedTokens.length > 0 ? ["description-close"] : [];

  if (containsEitherWay) {
    reasonCodes.push("normalized-match");
  }

  if (normalizedUnit && partidaUnit === normalizedUnit) {
    reasonCodes.push("unit-match");
  }

  if (normalizedUnit && partidaUnit !== normalizedUnit) {
    reasonCodes.push("unit-mismatch");
  }

  return buildSuggestion(partida, roundScore(Math.min(0.99, baseScore)), confidence, reasonCodes);
}

function buildSuggestion(
  partida: CatalogPartidaRecord,
  score: number,
  confidence: BudgetPasteSuggestionConfidence,
  reasonCodes: string[],
): BudgetPasteSuggestedMatch {
  return {
    partida,
    score: roundScore(score),
    confidence,
    reasonCodes,
  };
}

function resolveConfidence(score: number, unitMatches: boolean): BudgetPasteSuggestionConfidence {
  if (score >= 0.82 && unitMatches) return "high";
  if (score >= 0.82 && !unitMatches) return "medium";
  if (score >= 0.62) return "medium";
  return "low";
}

function isAmbiguousDescription(normalizedDescription: string) {
  if (normalizedDescription.length < MIN_DESCRIPTION_LENGTH) return true;

  const tokens = tokenize(normalizedDescription);
  if (tokens.length === 0) return true;
  if (tokens.length === 1) {
    return GENERIC_AMBIGUOUS_TOKENS.has(tokens[0] ?? "");
  }

  return false;
}

function tokenize(value: string) {
  return value
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function roundScore(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

const STOP_WORDS = new Set(["DE", "DEL", "LA", "EL", "LOS", "LAS", "CON", "PARA", "POR", "EN", "Y"]);
const GENERIC_AMBIGUOUS_TOKENS = new Set(["OBRA", "PARTIDA", "ITEM", "TRABAJO", "VARIOS"]);
