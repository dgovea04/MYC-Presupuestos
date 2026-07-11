import { prisma } from "@/lib/db/prisma";
import { searchSimilarPartidas } from "@/lib/partida-generation/similarity";
import { normalizePartidaText } from "@/lib/partida-generation/text";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { McpBudgetBlueprint } from "./mcp-blueprint";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CatalogMatchStatus = "matched" | "review_required" | "unmatched";

export type McpCatalogItemMatch = {
  sourceItemId: string;
  status: CatalogMatchStatus;
  catalogPartidaId: string | null;
  matchScore: number;
  reason: string;
  selectedDescription: string;
  selectedUnit: string;
  selectedUnitPrice: string;
};

// ─── Thresholds ─────────────────────────────────────────────────────────────

const MATCH_STRONG = 0.8;
const MATCH_REVIEW = 0.6;

// ─── Main function ──────────────────────────────────────────────────────────

export async function matchBlueprintItemsToCatalog(input: {
  blueprint: McpBudgetBlueprint;
}): Promise<McpCatalogItemMatch[]> {
  // Get all catalog partidas
  const catalogPartidas = await prisma.catalogPartida.findMany({
    include: {
      apuRows: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (catalogPartidas.length === 0) {
    // Return all items as unmatched if no catalog exists
    return input.blueprint.subBudgets.flatMap((sb) =>
      sb.items.map((item) => ({
        sourceItemId: item.sourceItemId,
        status: "unmatched" as const,
        catalogPartidaId: null,
        matchScore: 0,
        reason: "Catálogo vacío",
        selectedDescription: item.description,
        selectedUnit: item.unit,
        selectedUnitPrice: item.unitPrice,
      })),
    );
  }

  // Flatten all items from blueprint
  const allItems = input.blueprint.subBudgets.flatMap((sb) => sb.items);

  // Build catalog records for the similarity search
  const catalogRecords: CatalogPartidaRecord[] = catalogPartidas.map((p) => ({
    id: p.id,
    description: p.description,
    unit: p.unit,
    unitPrice: Number(p.unitPrice),
    currency: p.currency,
    source: p.source,
    performance: Number(p.performance),
    performanceUnit: p.performanceUnit,
    performanceRate: p.performanceRate,
    apuRows: p.apuRows.map((row) => ({
      id: row.id,
      catalogPartidaId: row.catalogPartidaId,
      resourceId: row.resourceId,
      catalogSubpartidaId: row.catalogSubpartidaId,
      description: row.description,
      unit: row.unit,
      crew: row.crew ? Number(row.crew) : null,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unitPrice),
      subtotal: Number(row.subtotal),
      resourceType: row.resourceType,
      groupLabel: row.groupLabel,
      sortOrder: row.sortOrder,
    })),
  }));

  // Build lookup by (description, unit) for exact match
  const catalogByKey = new Map<string, (typeof catalogRecords)[number]>();
  for (const record of catalogRecords) {
    const key = buildMatchKey(record.description, record.unit);
    catalogByKey.set(key, record);
  }

  const results: McpCatalogItemMatch[] = [];

  for (const item of allItems) {
    // 1. Try exact match by code (if code exists in catalog)
    const exactKey = buildMatchKey(item.description, item.unit);
    const exactMatch = catalogByKey.get(exactKey);

    if (exactMatch) {
      results.push({
        sourceItemId: item.sourceItemId,
        status: "matched",
        catalogPartidaId: exactMatch.id,
        matchScore: 1,
        reason: "Coincidencia exacta por descripción y unidad",
        selectedDescription: exactMatch.description,
        selectedUnit: exactMatch.unit,
        selectedUnitPrice: String(exactMatch.unitPrice),
      });
      continue;
    }

    // 2. Use searchSimilarPartidas for fuzzy matching
    const similar = searchSimilarPartidas({
      query: item.description,
      unit: item.unit,
      partidas: catalogRecords,
      limit: 3,
    });

    if (similar.length === 0 || similar[0].score < MATCH_REVIEW) {
      // No acceptable match
      results.push({
        sourceItemId: item.sourceItemId,
        status: "unmatched",
        catalogPartidaId: null,
        matchScore: similar.length > 0 ? similar[0].score : 0,
        reason: similar.length > 0
          ? `Puntaje de similitud insuficiente (${similar[0].score.toFixed(2)} < ${MATCH_REVIEW})`
          : "Sin coincidencias en el catálogo",
        selectedDescription: item.description,
        selectedUnit: item.unit,
        selectedUnitPrice: item.unitPrice,
      });
      continue;
    }

    const best = similar[0];

    if (best.score >= MATCH_STRONG) {
      results.push({
        sourceItemId: item.sourceItemId,
        status: "matched",
        catalogPartidaId: best.partida.id,
        matchScore: best.score,
        reason: `Coincidencia por similitud (score: ${best.score.toFixed(2)})`,
        selectedDescription: best.partida.description,
        selectedUnit: best.partida.unit,
        selectedUnitPrice: String(best.partida.unitPrice),
      });
    } else if (best.score >= MATCH_REVIEW) {
      results.push({
        sourceItemId: item.sourceItemId,
        status: "review_required",
        catalogPartidaId: best.partida.id,
        matchScore: best.score,
        reason: `Coincidencia débil, requiere revisión (score: ${best.score.toFixed(2)})`,
        selectedDescription: best.partida.description,
        selectedUnit: best.partida.unit,
        selectedUnitPrice: String(best.partida.unitPrice),
      });
    } else {
      results.push({
        sourceItemId: item.sourceItemId,
        status: "unmatched",
        catalogPartidaId: null,
        matchScore: best.score,
        reason: `Puntaje bajo (${best.score.toFixed(2)})`,
        selectedDescription: item.description,
        selectedUnit: item.unit,
        selectedUnitPrice: item.unitPrice,
      });
    }
  }

  return results;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildMatchKey(description: string, unit: string): string {
  return `${normalizePartidaText(description)}|${normalizePartidaText(unit)}`;
}
