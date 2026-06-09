import { searchCatalogPartidas, searchCatalogResources, tokenizeCatalogText } from "@/lib/ai/catalog-search";
import type { AiAction, AiContext } from "@/lib/ai/types";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

export type AiEvidenceSourceType = "catalog_partida" | "catalog_resource" | "s10_import" | "technical_doc";

export type AiEvidence = {
  id: string;
  sourceType: AiEvidenceSourceType;
  title: string;
  excerpt: string;
  score: number;
  metadata: Record<string, string | number | boolean>;
};

export type BuildAiRetrievalEvidenceInput = {
  query: string;
  action: Exclude<AiAction, "json">;
  unit?: string;
  context?: AiContext;
  catalogPartidas?: CatalogPartidaRecord[];
  resources?: ResourceRecord[];
  limit?: number;
};

type TechnicalSnippet = {
  id: string;
  title: string;
  sourcePath: string;
  tags: string[];
  excerpt: string;
};

const DEFAULT_EVIDENCE_LIMIT = 6;
const EXCERPT_LIMIT = 320;
const CATALOG_SCORE_FLOOR = 0.05;
const TECHNICAL_SCORE_FLOOR = 0.18;

const ACTION_TERMS: Record<Exclude<AiAction, "json">, string> = {
  chat: "consulta presupuesto obra costos apu catalogo",
  apu: "apu analisis precio unitario partida recursos rendimiento",
  review: "revision validacion consistencia presupuesto costos formula",
  autocomplete: "autocompletar sugerencia partida recurso catalogo",
};

const TECHNICAL_SNIPPETS: TechnicalSnippet[] = [
  {
    id: "formula-polinomica-monomios",
    title: "Formula polinomica Peru - reglas de monomios",
    sourcePath: "prd/formula-polinomica-peru-webapp-spec.md",
    tags: ["formula", "polinomica", "monomios", "incidencia", "reajuste", "0.05", "coeficientes"],
    excerpt:
      "Referencia interna: criterios de implementacion para formula polinomica, agrupacion de monomios, incidencia minima 0.05, coeficientes con 3 decimales y revision tecnica antes de usar resultados en presupuestos.",
  },
  {
    id: "apu-catalog-source-truth",
    title: "APU catalogo - fuente de verdad para propuestas",
    sourcePath: "prd/prd_ai_apu_catalog_rag_myc_presupuestos.md",
    tags: ["apu", "catalogo", "rag", "partidas", "recursos", "fuente", "evidencia", "presupuesto"],
    excerpt:
      "Referencia interna: las propuestas APU deben apoyarse en partidas y recursos trazables del catalogo, preservar unidad, rendimiento, costo unitario y marcar supuestos que requieren revision humana.",
  },
  {
    id: "partida-similarity-generation",
    title: "Generacion de partidas por similitud",
    sourcePath: "prd/PRD_Sistema_Generacion_Partidas_Similitud_V1.md",
    tags: ["partida", "similitud", "generacion", "catalogo", "apu", "recursos", "costos"],
    excerpt:
      "Referencia interna: la generacion de partidas por similitud compara descripcion, unidad y composicion APU para reutilizar recursos existentes y reducir duplicidad en catalogos de obra.",
  },
];

export function buildAiRetrievalEvidence(input: BuildAiRetrievalEvidenceInput): AiEvidence[] {
  const limit = normalizeLimit(input.limit);
  const retrievalQuery = buildRetrievalQuery(input);
  const searchLimit = Math.max(limit * 2, DEFAULT_EVIDENCE_LIMIT);
  const directPartidaScores = new Map(
    searchCatalogPartidas({
      query: input.query,
      unit: input.unit ?? input.context?.unit,
      partidas: input.catalogPartidas ?? [],
      limit: searchLimit,
    }).map((result) => [result.partida.id, result.similarity] as const),
  );

  const partidaResults = searchCatalogPartidas({
    query: retrievalQuery,
    unit: input.unit ?? input.context?.unit,
    partidas: input.catalogPartidas ?? [],
    limit: searchLimit,
  })
    .map((result) => ({
      partida: result.partida,
      similarity: Math.max(result.similarity, directPartidaScores.get(result.partida.id) ?? 0),
    }))
    .filter((result) => result.similarity > CATALOG_SCORE_FLOOR);

  const resourceResults = searchCatalogResources({
    query: retrievalQuery,
    similarPartidas: partidaResults,
    resources: input.resources ?? [],
    limit: searchLimit,
  }).filter((result) => result.score > CATALOG_SCORE_FLOOR);

  return [
    ...partidaResults.map((result) => mapPartidaEvidence(result.partida, result.similarity)),
    ...resourceResults.map((result) => mapResourceEvidence(result.resource, result.score)),
    ...searchTechnicalEvidence(retrievalQuery, searchLimit),
  ]
    .sort(compareEvidence)
    .slice(0, limit);
}

export function formatEvidenceBlock(evidence: AiEvidence[], limit?: number): string {
  if (evidence.length === 0) return "";

  const normalizedLimit = normalizeLimit(limit);
  const lines = [...evidence]
    .sort(compareEvidence)
    .slice(0, normalizedLimit)
    .flatMap((item, index) => [
      `${index + 1}. [${item.sourceType}] ${item.title} (score ${formatScore(item.score)})`,
      `   Extracto: ${truncateText(item.excerpt, EXCERPT_LIMIT)}`,
    ]);

  return ["Fuentes consultadas:", ...lines].join("\n");
}

function buildRetrievalQuery(input: BuildAiRetrievalEvidenceInput): string {
  const context = input.context;
  const fields = [
    input.query,
    ACTION_TERMS[input.action],
    input.unit,
    context?.project,
    context?.module,
    context?.selectedItem,
    context?.unit,
    context?.activeTable,
    typeof context?.currentCost === "number" ? context.currentCost.toString() : undefined,
  ];

  return fields.filter((field): field is string => typeof field === "string" && field.trim().length > 0).join(" ");
}

function mapPartidaEvidence(partida: CatalogPartidaRecord, score: number): AiEvidence {
  const source = partida.source ?? undefined;
  const apuDescriptions = partida.apuRows.map((row) => row.description).filter((description) => description.trim().length > 0);
  const excerptParts = [
    `Unidad: ${partida.unit}`,
    `Costo unitario: ${partida.currency} ${partida.unitPrice}`,
    `Rendimiento: ${partida.performance}${partida.performanceUnit ? ` ${partida.performanceUnit}` : ""}`,
    source ? `Fuente: ${source}` : undefined,
    apuDescriptions.length > 0 ? `APU: ${apuDescriptions.slice(0, 6).join(", ")}` : undefined,
  ];

  return {
    id: `partida:${partida.id}`,
    sourceType: isS10Source(source) ? "s10_import" : "catalog_partida",
    title: partida.description,
    excerpt: truncateText(excerptParts.filter(isPresent).join(". "), EXCERPT_LIMIT),
    score: roundScore(score),
    metadata: compactMetadata({
      partidaId: partida.id,
      unit: partida.unit,
      source,
      currency: partida.currency,
      unitPrice: partida.unitPrice,
      performance: partida.performance,
      performanceUnit: partida.performanceUnit,
      performanceRate: partida.performanceRate,
      apuRows: partida.apuRows.length,
    }),
  };
}

function mapResourceEvidence(resource: ResourceRecord, score: number): AiEvidence {
  const excerptParts = [
    `Categoria: ${resource.category}`,
    `Unidad: ${resource.unit}`,
    resource.source ? `Fuente: ${resource.source}` : undefined,
    resource.iu ? `IU: ${resource.iu}` : undefined,
    resource.iuCurrent ? `IU vigente: ${resource.iuCurrent}` : undefined,
  ];

  return {
    id: `resource:${resource.id}`,
    sourceType: "catalog_resource",
    title: resource.description,
    excerpt: truncateText(excerptParts.filter(isPresent).join(". "), EXCERPT_LIMIT),
    score: roundScore(score),
    metadata: compactMetadata({
      resourceId: resource.id,
      code: resource.code,
      category: resource.category,
      unit: resource.unit,
      source: resource.source,
      iu: resource.iu,
      iuCurrent: resource.iuCurrent,
      subcategory: resource.subcategory,
      currency: resource.currency,
      unitPrice: resource.unitPrice,
    }),
  };
}

function searchTechnicalEvidence(query: string, limit: number): AiEvidence[] {
  const queryTokens = tokenizeCatalogText(query);
  if (queryTokens.length === 0) return [];

  return TECHNICAL_SNIPPETS.map((snippet) => {
    const text = [snippet.title, snippet.sourcePath, snippet.tags.join(" "), snippet.excerpt].join(" ");
    const score = scoreTokenOverlap(queryTokens, tokenizeCatalogText(text));

    return {
      id: `technical:${snippet.id}`,
      sourceType: "technical_doc" as const,
      title: snippet.title,
      excerpt: truncateText(snippet.excerpt, EXCERPT_LIMIT),
      score: roundScore(score),
      metadata: {
        sourcePath: snippet.sourcePath,
        referenceType: "internal_technical_reference",
      },
    };
  })
    .filter((item) => item.score >= TECHNICAL_SCORE_FLOOR)
    .sort(compareEvidence)
    .slice(0, limit);
}

function scoreTokenOverlap(queryTokens: string[], candidateTokens: string[]): number {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;

  const querySet = new Set(queryTokens);
  const candidateSet = new Set(candidateTokens);
  const matches = [...querySet].filter((token) => candidateSet.has(token)).length;

  return matches / Math.max(querySet.size, 1);
}

function compareEvidence(left: AiEvidence, right: AiEvidence): number {
  if (right.score !== left.score) return right.score - left.score;
  return left.title.localeCompare(right.title);
}

function isS10Source(source: string | undefined): boolean {
  return typeof source === "string" && source.toLowerCase().includes("s10");
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_EVIDENCE_LIMIT;
  return Math.max(0, Math.floor(limit));
}

function compactMetadata(values: Record<string, string | number | boolean | null | undefined>): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string | number | boolean] => {
      const value = entry[1];
      return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
    }),
  );
}

function truncateText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function roundScore(score: number): number {
  return Number(Math.min(1, Math.max(0, score)).toFixed(3));
}

function formatScore(score: number): string {
  return roundScore(score).toFixed(3);
}

function isPresent(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
