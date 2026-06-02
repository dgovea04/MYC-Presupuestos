import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

export type CatalogPartidaSearchResult = {
  partida: CatalogPartidaRecord;
  similarity: number;
};

export type CatalogResourceSearchResult = {
  resource: ResourceRecord;
  score: number;
};

type SearchCatalogPartidasInput = {
  query: string;
  unit?: string;
  partidas: CatalogPartidaRecord[];
  limit?: number;
};

type SearchCatalogResourcesInput = {
  query: string;
  similarPartidas?: CatalogPartidaSearchResult[];
  resources: ResourceRecord[];
  limit?: number;
};

const STOP_WORDS = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "el",
  "en",
  "la",
  "las",
  "los",
  "para",
  "por",
  "un",
  "una",
  "y",
]);

export function searchCatalogPartidas({
  query,
  unit,
  partidas,
  limit = 5,
}: SearchCatalogPartidasInput): CatalogPartidaSearchResult[] {
  const queryTokens = tokenizeCatalogText(query);
  const coreQueryTokens = tokenizeCatalogText(extractCatalogPartidaCore(query));
  const normalizedUnit = normalizeCatalogText(unit ?? "");

  return partidas
    .map((partida) => {
      const apuText = partida.apuRows
        .map((row) => [row.description, row.unit, row.resourceType].filter(Boolean).join(" "))
        .join(" ");
      const text = [partida.description, partida.unit, partida.source, apuText].filter(Boolean).join(" ");
      const descriptionTokens = tokenizeCatalogText(partida.description);
      const textTokens = tokenizeCatalogText(text);
      const coreScore = scoreTokens(coreQueryTokens, descriptionTokens);
      const fullScore = scoreTokens(queryTokens, textTokens);
      const containsScore = scoreContainsEitherWay(extractCatalogPartidaCore(query), partida.description);
      const baseScore = coreScore * 0.62 + fullScore * 0.28 + containsScore * 0.1;
      const unitScore = normalizedUnit && normalizeCatalogText(partida.unit) === normalizedUnit ? 0.25 : 0;

      return {
        partida,
        similarity: roundScore(Math.min(1, baseScore + unitScore)),
      };
    })
    .sort(comparePartidaResults)
    .slice(0, limit);
}

export function searchCatalogResources({
  query,
  similarPartidas = [],
  resources,
  limit = 30,
}: SearchCatalogResourcesInput): CatalogResourceSearchResult[] {
  const referenceText = similarPartidas
    .flatMap((result) => [result.partida.description, ...result.partida.apuRows.map((row) => row.description)])
    .join(" ");
  const queryTokens = tokenizeCatalogText([extractCatalogPartidaCore(query), query, referenceText].join(" "));
  const usedResourceIds = new Set(
    similarPartidas.flatMap((result) =>
      result.partida.apuRows.map((row) => row.resourceId).filter((resourceId): resourceId is string => typeof resourceId === "string" && resourceId.length > 0),
    ),
  );

  return resources
    .map((resource) => {
      const text = [resource.code, resource.description, resource.category, resource.subcategory, resource.unit, resource.iu, resource.iuCurrent]
        .filter(Boolean)
        .join(" ");
      const baseScore = scoreTokens(queryTokens, tokenizeCatalogText(text));
      const usageBoost = usedResourceIds.has(resource.id) ? 0.35 : 0;

      return {
        resource,
        score: roundScore(Math.min(1, baseScore + usageBoost)),
      };
    })
    .sort(compareResourceResults)
    .slice(0, limit);
}

export function tokenizeCatalogText(value: string): string[] {
  const normalized = normalizeCatalogText(value);
  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 || /^\d+$/.test(token))
    .filter((token) => !STOP_WORDS.has(token));
}

export function extractCatalogPartidaCore(value: string) {
  const normalized = normalizeCatalogText(value);
  if (!normalized) return "";

  const splitIndex = findSpecificationStartIndex(normalized);
  const core = splitIndex === -1 ? normalized : normalized.slice(0, splitIndex).trim();

  return tokenizeCatalogText(core).length >= 2 ? core : normalized;
}

function normalizeCatalogText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/f\s*'?c/gi, "fc")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findSpecificationStartIndex(value: string) {
  const patterns = [
    /\b(?:h|altura|prof|profundidad|d|diametro|e|espesor)\s+\d/,
    /\bhasta\s+\d/,
    /\bde\s+\d/,
    /\ben\s+terreno\b/,
    /\bterreno\s+(?:normal|suelto|rocoso|semirrocoso|compacto)\b/,
  ];
  const indexes = patterns
    .map((pattern) => value.search(pattern))
    .filter((index) => index > 0);

  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

function scoreTokens(queryTokens: string[], candidateTokens: string[]) {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;

  const querySet = new Set(queryTokens);
  const candidateSet = new Set(candidateTokens);
  const matches = [...querySet].filter((token) => candidateSet.has(token)).length;
  const denominator = Math.max(querySet.size, 1);

  return matches / denominator;
}

function scoreContainsEitherWay(left: string, right: string) {
  const normalizedLeft = normalizeCatalogText(left);
  const normalizedRight = normalizeCatalogText(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft) ? 1 : 0;
}

function comparePartidaResults(left: CatalogPartidaSearchResult, right: CatalogPartidaSearchResult) {
  if (right.similarity !== left.similarity) return right.similarity - left.similarity;
  return left.partida.description.localeCompare(right.partida.description);
}

function compareResourceResults(left: CatalogResourceSearchResult, right: CatalogResourceSearchResult) {
  if (right.score !== left.score) return right.score - left.score;
  return left.resource.description.localeCompare(right.resource.description);
}

function roundScore(score: number) {
  return Number(score.toFixed(3));
}
