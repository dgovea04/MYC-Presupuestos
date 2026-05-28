import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber, serializeCatalogPartida } from "@/lib/db/serializers";
import { calculateApuRows, calculateApuTotalUnitCost } from "@/lib/calculations/apu";
import { aggregateSuggestedInsumos } from "@/lib/partida-generation/aggregation";
import { searchSimilarPartidas } from "@/lib/partida-generation/similarity";
import { extractPartidaVariables } from "@/lib/partida-generation/variables";
import { getCatalogPartidas } from "@/lib/data/partidas";
import { getResourcesByUser } from "@/lib/data/resources";
import {
  partidaGenerationAggregateSchema,
  partidaGenerationSaveSchema,
  partidaGenerationSearchSchema,
  type PartidaGenerationAggregateInput,
  type PartidaGenerationSaveInput,
  type PartidaGenerationSearchInput,
} from "@/lib/validations/partida-generation";
import type { Prisma } from "@prisma/client";
import type { PartidaApuRowInput } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";
import type { PartidaGenerationSaveResult } from "@/types/partida-generation";

export async function searchPartidaGenerationCandidates(userId: string, input: PartidaGenerationSearchInput) {
  const query = partidaGenerationSearchSchema.parse(input);
  const partidas = await getCatalogPartidas();
  const resources = await getGenerationResources(userId);
  const referenceResourceNames = resources
    .filter((resource) => query.sourceText.toLowerCase().includes(resource.description.toLowerCase()))
    .map((resource) => resource.description);

  return {
    sourceVariables: extractPartidaVariables(query.sourceText, query.unit),
    candidates: searchSimilarPartidas({
      query: query.sourceText,
      unit: query.unit,
      partidas,
      referenceResourceNames,
      limit: query.limit,
    }),
  };
}

export async function aggregatePartidaGenerationSuggestions(userId: string, input: PartidaGenerationAggregateInput) {
  const parsed = partidaGenerationAggregateSchema.parse(input);
  const [partidas, resources] = await Promise.all([getCatalogPartidas(), getGenerationResources(userId)]);
  const partidasById = new Map(partidas.map((partida) => [partida.id, partida]));

  return aggregateSuggestedInsumos({
    selectedPartidas: parsed.selectedSources.map((source) => {
      const partida = partidasById.get(source.partidaId);
      if (!partida) {
        throw new Error("Una partida fuente seleccionada ya no existe");
      }

      return {
        partida,
        score: source.score,
        isPrimary: source.isPrimary,
      };
    }),
    resources,
  });
}

export async function saveGeneratedPartida(userId: string, input: PartidaGenerationSaveInput): Promise<PartidaGenerationSaveResult> {
  const parsed = partidaGenerationSaveSchema.parse(input);
  const resources = await getGenerationResources(userId);
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
  assertReferencedResourcesAreCatalogBacked(parsed, resourcesById);

  return prisma.$transaction(async (tx) => {
    await assertSourcePartidasExist(tx, parsed.selectedSources.map((source) => source.partidaId));

    const normalizedRows = buildReviewedApuRows(parsed, resourcesById);
    const calculatedRows = calculateApuRows(normalizedRows, parsed.performance);
    const unitPrice = calculateApuTotalUnitCost(calculatedRows, parsed.performance);
    const catalogPartida = await tx.catalogPartida.create({
      data: {
        description: parsed.generatedName.trim(),
        unit: parsed.unit.trim(),
        unitPrice,
        currency: "PEN",
        source: "Generada por similitud V1",
        performance: parsed.performance,
        performanceUnit: parsed.unit.trim(),
        performanceRate: buildPerformanceRate(parsed.performance, parsed.unit),
        apuRows: {
          create: calculatedRows.map((row, index) => ({
            resourceId: row.resourceId,
            description: row.description,
            unit: row.unit,
            crew: row.crew ?? null,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            subtotal: row.subtotal,
            resourceType: row.resourceType,
            groupLabel: row.groupLabel ?? null,
            sortOrder: index,
          })),
        },
      },
      include: {
        apuRows: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    const generatedPartida = await tx.generatedPartida.create({
      data: {
        sourceText: parsed.sourceText.trim(),
        generatedName: parsed.generatedName.trim(),
        unit: parsed.unit.trim(),
        similarityScore: parsed.similarityScore,
        createdById: userId,
        generatedCatalogPartidaId: catalogPartida.id,
        metadata: {
          insumoCount: parsed.insumos.length,
          primarySourceId: parsed.selectedSources.find((source) => source.isPrimary)?.partidaId ?? null,
          generatedBy: "similarity-v1",
        },
        sources: {
          create: parsed.selectedSources.map((source) => ({
            partidaSourceId: source.partidaId,
            score: source.score,
            isPrimary: source.isPrimary ?? false,
          })),
        },
        insumos: {
          create: parsed.insumos.map((insumo) => {
            const catalogResource = insumo.resourceId ? resourcesById.get(insumo.resourceId) : null;
            return {
              resourceId: catalogResource?.id ?? null,
              description: catalogResource?.description ?? insumo.description.trim(),
              unit: catalogResource?.unit ?? insumo.unit.trim(),
              resourceType: catalogResource?.category ?? insumo.resourceType ?? null,
              suggestedQuantity: insumo.suggestedQuantity,
              finalQuantity: insumo.finalQuantity,
              unitPrice: catalogResource?.unitPrice ?? 0,
              confidence: insumo.confidence,
              confidenceLevel: insumo.confidenceLevel,
              calculationMethod: insumo.calculationMethod,
              sourcePartidaIds: insumo.sourcePartidaIds,
              statistics: insumo.statistics,
            };
          }),
        },
      },
    });

    return {
      generatedPartidaId: generatedPartida.id,
      catalogPartida: serializeCatalogPartida(catalogPartida),
    };
  });
}

function assertReferencedResourcesAreCatalogBacked(input: PartidaGenerationSaveInput, resourcesById: Map<string, ResourceRecord>) {
  for (const insumo of input.insumos) {
    if (insumo.resourceId && !resourcesById.has(insumo.resourceId)) {
      throw new Error("Un insumo seleccionado no existe en el catalogo disponible");
    }
  }
}

async function assertSourcePartidasExist(tx: Prisma.TransactionClient, partidaIds: string[]) {
  const uniqueIds = [...new Set(partidaIds)];
  const count = await tx.catalogPartida.count({
    where: {
      id: {
        in: uniqueIds,
      },
    },
  });

  if (count !== uniqueIds.length) {
    throw new Error("Una partida fuente seleccionada ya no existe");
  }
}

function buildReviewedApuRows(input: PartidaGenerationSaveInput, resourcesById: Map<string, ResourceRecord>): PartidaApuRowInput[] {
  return input.insumos.map((insumo, index) => {
    const resource = insumo.resourceId ? resourcesById.get(insumo.resourceId) : null;
    const unitPrice = resource ? resource.unitPrice : 0;
    const quantity = insumo.finalQuantity;

    return {
      resourceId: resource?.id,
      description: resource?.description ?? insumo.description.trim(),
      unit: resource?.unit ?? insumo.unit.trim(),
      crew: insumo.finalCrew ?? insumo.suggestedCrew ?? null,
      quantity,
      unitPrice,
      subtotal: Number(new Decimal(quantity).times(unitPrice).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString()),
      resourceType: resource?.category ?? insumo.resourceType ?? undefined,
      groupLabel: undefined,
      sortOrder: index,
    };
  });
}

function buildPerformanceRate(performance: number, unit: string) {
  const normalizedUnit = unit.trim();
  return normalizedUnit ? `${performance.toFixed(4)} ${normalizedUnit}/DIA` : `${performance.toFixed(4)}`;
}

async function getGenerationResources(userId: string): Promise<ResourceRecord[]> {
  const resources = await getResourcesByUser(userId);

  return resources.map((resource) => ({
    id: resource.id,
    companyId: resource.companyId,
    code: resource.code,
    description: resource.description,
    category: resource.category,
    iu: resource.iu,
    subcategory: resource.subcategory,
    unit: resource.unit,
    unitPrice: decimalToNumber(resource.unitPrice),
    currency: resource.currency,
    source: resource.source,
    createdAt: resource.createdAt instanceof Date ? resource.createdAt.toISOString() : undefined,
    updatedAt: resource.updatedAt instanceof Date ? resource.updatedAt.toISOString() : undefined,
  }));
}
