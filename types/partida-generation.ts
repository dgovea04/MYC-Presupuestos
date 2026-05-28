import type { CatalogPartidaRecord } from "@/types/partida";

export type PartidaTechnicalVariables = {
  normalizedText: string;
  material: string | null;
  resistance: string | null;
  element: string | null;
  category: string | null;
  unit: string | null;
  technicalSpecs: string[];
  keywords: string[];
};

export type SimilarityBreakdown = {
  element: number;
  technical: number;
  material: number;
  unit: number;
  category: number;
  text: number;
};

export type SimilarPartidaResult = {
  partida: CatalogPartidaRecord;
  score: number;
  compositionSimilarity: number;
  breakdown: SimilarityBreakdown;
  variables: PartidaTechnicalVariables;
};

export type SelectedPartidaForAggregation = {
  partida: CatalogPartidaRecord;
  score: number;
  isPrimary?: boolean;
};

export type SuggestedInsumoConfidenceLevel = "auto" | "review" | "optional";

export type SuggestedInsumoStatistics = {
  average: number;
  median: number;
  minimum: number;
  maximum: number;
  standardDeviation: number;
};

export type SuggestedInsumo = {
  key: string;
  resourceId: string | null;
  description: string;
  unit: string;
  resourceType: string | null;
  frequency: number;
  confidenceLevel: SuggestedInsumoConfidenceLevel;
  suggestedCrew: number | null;
  suggestedQuantity: number;
  unitPrice: number | null;
  priceSource: "catalog" | "unmatched";
  calculationMethod: "weighted_median";
  statistics: SuggestedInsumoStatistics;
  sourcePartidaIds: string[];
};

export type PartidaGenerationSearchResult = {
  sourceVariables: PartidaTechnicalVariables;
  candidates: SimilarPartidaResult[];
};

export type PartidaGenerationSaveResult = {
  generatedPartidaId: string;
  catalogPartida: CatalogPartidaRecord;
};
