import { normalizeResourceIuCode } from "@/lib/resources/iu";
import type { UnifiedIndexDictionaryRow, UnifiedIndexRelationRow } from "@/types/unified-index";

export type ResourceIuSuggestion = {
  code: string;
  label: string;
  score: number;
  source: "dictionary" | "index";
};

type SuggestResourceIuInput = {
  description: string;
  dictionaryRows: UnifiedIndexDictionaryRow[];
  unifiedIndexRows: UnifiedIndexRelationRow[];
  maxSuggestions?: number;
};

const DEFAULT_MAX_SUGGESTIONS = 3;
const MIN_SUGGESTION_SCORE = 0.58;
const STOP_WORDS = new Set(["A", "AL", "DE", "DEL", "EL", "EN", "LA", "LAS", "LOS", "PARA", "POR", "TIPO", "Y"]);

export function suggestResourceIuCodes(input: SuggestResourceIuInput): ResourceIuSuggestion[] {
  const maxSuggestions = input.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS;
  const description = normalizeCatalogText(input.description);
  if (!description) return [];

  const descriptionTokens = toTokenSet(description);
  const suggestionsByCode = new Map<string, ResourceIuSuggestion>();

  for (const row of input.dictionaryRows) {
    const code = normalizeResourceIuCode(row.code);
    if (!code) continue;

    const score = scoreCandidate({
      description,
      descriptionTokens,
      candidate: row.element,
      note: row.note,
    });
    if (score < MIN_SUGGESTION_SCORE) continue;

    upsertSuggestion(suggestionsByCode, {
      code,
      label: cleanDisplayText(row.element),
      score,
      source: "dictionary",
    });
  }

  for (const row of input.unifiedIndexRows) {
    const code = normalizeResourceIuCode(row.code);
    if (!code) continue;

    const score = scoreCandidate({
      description,
      descriptionTokens,
      candidate: row.name,
      note: null,
    });
    if (score < MIN_SUGGESTION_SCORE) continue;

    upsertSuggestion(suggestionsByCode, {
      code,
      label: cleanDisplayText(row.name),
      score: score - 0.05,
      source: "index",
    });
  }

  return [...suggestionsByCode.values()]
    .sort((left, right) => right.score - left.score || left.code.localeCompare(right.code))
    .slice(0, maxSuggestions);
}

function scoreCandidate({
  description,
  descriptionTokens,
  candidate,
  note,
}: {
  description: string;
  descriptionTokens: Set<string>;
  candidate: string;
  note: string | null;
}) {
  const normalizedCandidate = normalizeCatalogText(candidate);
  const candidateTokens = [...toTokenSet(normalizedCandidate)];
  if (candidateTokens.length === 0) return 0;

  const matchingTokens = candidateTokens.filter((token) => descriptionTokens.has(token)).length;
  const coverage = matchingTokens / candidateTokens.length;
  const startsWithMatch = descriptionTokens.has(candidateTokens[0]) ? 0.35 : 0;
  const phraseMatch = description.includes(normalizedCandidate) ? 0.4 : 0;
  const materialHint = getMaterialHintScore(descriptionTokens, candidateTokens);
  const shapeProfileHint = hasProfileDimensions(description) && isMetalProfileCandidate(candidateTokens) ? 0.18 : 0;
  const notePenalty = note ? 0.08 : 0;

  return coverage + startsWithMatch + phraseMatch + materialHint + shapeProfileHint - notePenalty;
}

function getMaterialHintScore(descriptionTokens: Set<string>, candidateTokens: string[]) {
  const candidateSet = new Set(candidateTokens);
  let score = 0;

  if (descriptionTokens.has("ACERO") && candidateSet.has("ACERO")) score += 0.24;
  if (descriptionTokens.has("ALUMINIO") && candidateSet.has("ALUMINIO")) score += 0.24;
  if (descriptionTokens.has("CARBONO") && candidateSet.has("CARBONO")) score += 0.16;
  if (descriptionTokens.has("FIERRO") && candidateSet.has("ACERO")) score += 0.12;

  return score;
}

function isMetalProfileCandidate(tokens: string[]) {
  const tokenSet = new Set(tokens);
  return (
    tokenSet.has("ANGULO") ||
    tokenSet.has("CANAL") ||
    tokenSet.has("PERFIL") ||
    tokenSet.has("PLATINA") ||
    tokenSet.has("TUBO") ||
    tokenSet.has("VIGA")
  );
}

function hasProfileDimensions(value: string) {
  return /\b\d+(\.\d+)?\s*(X|MM|CM|M|PULG)\b/.test(value) || /["']/.test(value);
}

function upsertSuggestion(suggestionsByCode: Map<string, ResourceIuSuggestion>, suggestion: ResourceIuSuggestion) {
  const current = suggestionsByCode.get(suggestion.code);
  if (!current || suggestion.score > current.score) {
    suggestionsByCode.set(suggestion.code, suggestion);
  }
}

function normalizeCatalogText(value: string) {
  return cleanDisplayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function toTokenSet(value: string) {
  return new Set(value.split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token)));
}

function cleanDisplayText(value: string) {
  return value
    .replace(/Ã/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã/g, "Í")
    .replace(/Ã“/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ");
}
