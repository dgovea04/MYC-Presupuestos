import type { CatalogPartidaSearchResult } from "@/lib/ai/catalog-search";
import { extractCatalogPartidaCore, searchCatalogPartidas, searchCatalogResources } from "@/lib/ai/catalog-search";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

type BuildApuCatalogContextInput = {
  query: string;
  unit?: string;
  category?: string;
  projectType?: string;
  partidas: CatalogPartidaRecord[];
  resources: ResourceRecord[];
};

export type ApuCatalogContext = ReturnType<typeof buildApuCatalogContext>;

export function buildApuCatalogContext({
  query,
  unit,
  category,
  projectType,
  partidas,
  resources,
}: BuildApuCatalogContextInput) {
  const candidatePartidas = searchCatalogPartidas({
    query,
    unit,
    partidas,
    limit: 12,
  });
  const partidasWithApu = candidatePartidas.filter(({ partida }) => partida.apuRows.length > 0);
  const similarPartidas = (partidasWithApu.length > 0 ? partidasWithApu : candidatePartidas).slice(0, 3);
  const matchingResources = searchCatalogResources({
    query: [extractCatalogPartidaCore(query), query, category, projectType].filter(Boolean).join(" "),
    similarPartidas,
    resources,
    limit: 15,
  });

  return {
    query,
    unit: unit ?? null,
    category: category ?? null,
    projectType: projectType ?? null,
    similarPartidas: similarPartidas.map(mapPartidaContext),
    matchingResources: matchingResources.map(({ resource, score }) => ({
      id: resource.id,
      code: resource.code,
      name: resource.description,
      unit: resource.unit,
      category: resource.category,
      unitPrice: resource.unitPrice,
      currency: resource.currency,
      score,
    })),
    rules: [
      "Usa unicamente resource_id existentes en matchingResources.",
      "No inventes insumos, codigos ni unidades.",
      "Si falta un insumo, registralo en suggested_new_resources.",
      "Devuelve solo JSON valido.",
      "La propuesta requiere revision humana antes de guardarse.",
    ],
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["partida_name", "unit", "confidence", "items", "suggested_new_resources", "warnings", "requires_human_review"],
      properties: {
        partida_name: { type: "string", minLength: 1 },
        unit: { type: "string", minLength: 1 },
        based_on_partida_id: { type: "string", minLength: 1, optional: true },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["resource_id", "name", "type", "unit", "quantity", "source", "requires_review"],
            properties: {
              resource_id: { type: "string", enumFrom: "matchingResources[].id" },
              name: { type: "string", enumFrom: "matchingResources[].name" },
              type: { type: "string", enum: ["MATERIAL", "LABOR", "EQUIPMENT", "TOOLS"] },
              unit: { type: "string", enumFrom: "matchingResources[].unit" },
              quantity: { type: "number", minimum: 0 },
              source: { type: "string", const: "catalog" },
              requires_review: { type: "boolean" },
            },
          },
        },
        suggested_new_resources: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "reason", "based_on"],
            properties: {
              type: { type: "string", const: "suggested_new_resource" },
              reason: { type: "string", minLength: 1 },
              based_on: { type: "string", minLength: 1 },
            },
          },
        },
        warnings: { type: "array", items: { type: "string", minLength: 1 } },
        requires_human_review: { type: "boolean", const: true },
      },
    },
  };
}

function mapPartidaContext({ partida, similarity }: CatalogPartidaSearchResult) {
  return {
    id: partida.id,
    description: partida.description,
    unit: partida.unit,
    unitPrice: partida.unitPrice,
    performance: partida.performance,
    similarity,
    apuRows: partida.apuRows.slice(0, 20).map((row) => ({
      resource_id: row.resourceId ?? null,
      description: row.description,
      unit: row.unit,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      resourceType: row.resourceType ?? null,
    })),
  };
}
