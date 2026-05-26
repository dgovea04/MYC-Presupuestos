import Decimal from "decimal.js";
import type { AiApuCatalogGenerationResult, AiApuCatalogProposal, AiApuStructuredData, AiStructuredLineItem } from "@/lib/ai/types";
import type { ApuResourceRecord } from "@/types/apu";
import type { PartidaApuRowRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

type AiApuResourceType = "MATERIAL" | "LABOR" | "EQUIPMENT";

type BuildApuRowsFromAiSuggestionInput = {
  suggestion: AiApuStructuredData;
  catalogPartidaId: string;
  existingRowsCount: number;
  createId?: (index: number) => string;
};

type SuggestionBucket = {
  resourceType: AiApuResourceType;
  items: AiStructuredLineItem[];
};

type BuildApuRowsFromCatalogProposalInput = {
  proposal: AiApuCatalogProposal;
  catalogPartidaId: string;
  resources: ResourceRecord[];
  existingRowsCount: number;
  createId?: (index: number) => string;
};

type BuildApuResourcesFromCatalogProposalInput = {
  proposal: AiApuCatalogProposal;
  apuId: string;
  resources: ResourceRecord[];
  createId?: (index: number) => string;
};

type SelectCatalogProposalBasePartidaInput = {
  result: AiApuCatalogGenerationResult;
  partidaId: string;
};

const DEFAULT_CREATE_ID = () => crypto.randomUUID();

export function parseAiDecimal(value: string): number | null {
  const normalizedValue = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(",", ".");
  const match = normalizedValue.match(/-?\d+(?:\.\d+)?/);

  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseAiPerformance(value: string, fallback: number): number {
  return parseAiDecimal(value) ?? fallback;
}

export function selectCatalogProposalBasePartida({
  result,
  partidaId,
}: SelectCatalogProposalBasePartidaInput): AiApuCatalogGenerationResult {
  const selectedPartida = result.similar_partidas.find((partida) => partida.id === partidaId);

  if (!selectedPartida || selectedPartida.items.length === 0) {
    return result;
  }

  const nextConfidence = Number(Math.max(0.35, Math.min(0.7, selectedPartida.similarity)).toFixed(2));

  return {
    ...result,
    proposal: {
      ...result.proposal,
      unit: selectedPartida.unit || result.proposal.unit,
      based_on_partida_id: selectedPartida.id,
      confidence: nextConfidence,
      items: selectedPartida.items,
      requires_human_review: true,
    },
    confidence: nextConfidence,
    validation: {
      ...result.validation,
      isValid: true,
    },
  };
}

export function buildApuRowsFromAiSuggestion({
  suggestion,
  catalogPartidaId,
  existingRowsCount,
  createId = DEFAULT_CREATE_ID,
}: BuildApuRowsFromAiSuggestionInput): PartidaApuRowRecord[] {
  const buckets: SuggestionBucket[] = [
    { resourceType: "MATERIAL", items: suggestion.materials },
    { resourceType: "LABOR", items: suggestion.labor },
    { resourceType: "EQUIPMENT", items: suggestion.equipment },
  ];

  return buckets.flatMap(({ resourceType, items }) =>
    items.map((item, itemIndex) => {
      const globalIndex = buckets
        .slice(0, buckets.findIndex((bucket) => bucket.resourceType === resourceType))
        .reduce((total, bucket) => total + bucket.items.length, 0) + itemIndex;

      return {
        id: createId(globalIndex),
        catalogPartidaId,
        description: item.description.trim() || "Recurso sugerido sin descripcion",
        unit: item.unit.trim(),
        crew: undefined,
        quantity: parseAiDecimal(item.quantity) ?? 0,
        unitPrice: 0,
        subtotal: 0,
        resourceType,
        groupLabel: item.notes?.trim() || undefined,
        sortOrder: existingRowsCount + globalIndex,
      };
    }),
  );
}

export function buildApuRowsFromCatalogProposal({
  proposal,
  catalogPartidaId,
  resources,
  existingRowsCount,
  createId = DEFAULT_CREATE_ID,
}: BuildApuRowsFromCatalogProposalInput): PartidaApuRowRecord[] {
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));

  return proposal.items.flatMap((item, index) => {
    const resource = resourcesById.get(item.resource_id);
    if (!resource) return [];

    const subtotal = multiplyDecimalToNumber(item.quantity, resource.unitPrice);

    return [
      {
        id: createId(index),
        catalogPartidaId,
        resourceId: resource.id,
        description: resource.description,
        unit: resource.unit,
        crew: undefined,
        quantity: item.quantity,
        unitPrice: resource.unitPrice,
        subtotal,
        resourceType: resource.category,
        groupLabel: item.requires_review ? "Requiere revision IA" : undefined,
        sortOrder: existingRowsCount + index,
      },
    ];
  });
}

export function buildApuResourcesFromCatalogProposal({
  proposal,
  apuId,
  resources,
  createId = DEFAULT_CREATE_ID,
}: BuildApuResourcesFromCatalogProposalInput): ApuResourceRecord[] {
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));

  return proposal.items.flatMap((item, index) => {
    const resource = resourcesById.get(item.resource_id);
    if (!resource) return [];

    return [
      {
        id: createId(index),
        apuId,
        resourceId: resource.id,
        resourceType: resource.category,
        crew: null,
        quantity: item.quantity,
        unitPrice: resource.unitPrice,
        subtotal: multiplyDecimalToNumber(item.quantity, resource.unitPrice),
        resource,
      },
    ];
  });
}

function multiplyDecimalToNumber(left: Decimal.Value, right: Decimal.Value) {
  return new Decimal(left).times(right).toDecimalPlaces(4).toNumber();
}
