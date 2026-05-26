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

  const normalizedCoreDescription = extractPartidaCoreDescription(normalizedDescription);
  const descriptionTokens = tokenize(normalizedDescription);
  const coreDescriptionTokens = tokenize(normalizedCoreDescription);
  const partidaTokens = tokenize(partidaDescription);
  const comparableDescriptionTokens = descriptionTokens.map(toComparableToken);
  const comparableCoreDescriptionTokens = coreDescriptionTokens.map(toComparableToken);
  const comparablePartidaTokens = partidaTokens.map(toComparableToken);
  const sharedComparableTokens = comparableDescriptionTokens.filter((token) => comparablePartidaTokens.includes(token));
  const sharedCoreTokens = comparableCoreDescriptionTokens.filter((token) => comparablePartidaTokens.includes(token));
  const tokenCoverage =
    comparableDescriptionTokens.length > 0 ? sharedComparableTokens.length / Math.max(comparableDescriptionTokens.length, 1) : 0;
  const coreTokenCoverage =
    comparableCoreDescriptionTokens.length > 0 ? sharedCoreTokens.length / Math.max(comparableCoreDescriptionTokens.length, 1) : tokenCoverage;
  const containsEitherWay =
    partidaDescription.includes(normalizedDescription) || normalizedDescription.includes(partidaDescription);
  const coreContainsEitherWay =
    partidaDescription.includes(normalizedCoreDescription) || normalizedCoreDescription.includes(partidaDescription);
  const prefixBonus =
    partidaDescription.startsWith(normalizedCoreDescription) || normalizedCoreDescription.startsWith(partidaDescription) ? 0.08 : 0;
  const containsBonus = containsEitherWay ? 0.18 : 0;
  const coreContainsBonus = coreContainsEitherWay ? 0.2 : 0;
  const unitBonus = normalizedUnit && partidaUnit === normalizedUnit ? 0.22 : 0;
  const unitPenalty = normalizedUnit && partidaUnit !== normalizedUnit ? 0.18 : 0;
  const lengthPenalty = Math.abs(partidaDescription.length - normalizedDescription.length) > 24 ? 0.06 : 0;
  const baseScore = coreTokenCoverage * 0.62 + tokenCoverage * 0.28 + containsBonus + coreContainsBonus + prefixBonus + unitBonus - unitPenalty - lengthPenalty;

  if (sharedComparableTokens.length === 0 && sharedCoreTokens.length === 0 && !containsEitherWay && !coreContainsEitherWay) {
    return null;
  }

  if (baseScore < 0.2) {
    return null;
  }

  const confidence = resolveConfidence(baseScore, Boolean(normalizedUnit && partidaUnit === normalizedUnit));
  const reasonCodes = sharedComparableTokens.length > 0 ? ["description-close"] : [];

  if (containsEitherWay || coreContainsEitherWay) {
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

function extractPartidaCoreDescription(normalizedDescription: string) {
  const splitIndex = findSpecificationStartIndex(normalizedDescription);
  const core = splitIndex === -1 ? normalizedDescription : normalizedDescription.slice(0, splitIndex).trim();

  return tokenize(core).length >= 2 ? core : normalizedDescription;
}

function findSpecificationStartIndex(value: string) {
  const patterns = [
    /\b(?:H|ALTURA|PROF|PROFUNDIDAD|D|DIAMETRO|E|ESPESOR)\s+\d/,
    /\bF\s*C\s+\d/,
    /\bHASTA\s+\d/,
    /\bDE\s+\d/,
    /\bEN\s+TERRENO\b/,
    /\bTERRENO\s+(?:NORMAL|SUELTO|ROCOSO|SEMIROCOSO|COMPACTO)\b/,
  ];
  const indexes = patterns
    .map((pattern) => value.search(pattern))
    .filter((index) => index > 0);

  return indexes.length > 0 ? Math.min(...indexes) : -1;
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

function toComparableToken(token: string) {
  if (token.length > 4 && token.endsWith("S")) {
    return token.slice(0, -1);
  }

  return token;
}

function roundScore(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

const STOP_WORDS = new Set(["DE", "DEL", "LA", "EL", "LOS", "LAS", "CON", "PARA", "POR", "EN", "Y"]);
const GENERIC_AMBIGUOUS_TOKENS = new Set(["OBRA", "PARTIDA", "ITEM", "TRABAJO", "VARIOS"]);
