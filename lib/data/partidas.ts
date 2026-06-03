import { prisma } from "@/lib/db/prisma";
import { serializeCatalogPartida } from "@/lib/db/serializers";
import { calculateApuRows, calculateApuTotalUnitCost } from "@/lib/calculations/apu";
import { catalogPartidaStatePatchSchema, catalogPartidaSchema, type CatalogPartidaApuRowInput, type CatalogPartidaInput } from "@/lib/validations/partida";
import type { CatalogPartidaPatchResult, CatalogPartidaRecord, CatalogPartidaStatePatch } from "@/types/partida";

export const CATALOG_PARTIDAS_CACHE_TAG = "catalog-partidas";

export async function getCatalogPartidas() {
  return getCatalogPartidasFromDatabase();
}

async function getCatalogPartidasFromDatabase() {
  const partidas = await prisma.catalogPartida.findMany({
    include: {
      apuRows: {
        orderBy: { sortOrder: "asc" },
        include: {
          catalogSubpartida: {
            include: {
              apuRows: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
    orderBy: [{ description: "asc" }],
  });

  return partidas.map((partida) => serializeCatalogPartida(partida));
}

export async function saveCatalogPartidasPatch(patchInput: CatalogPartidaStatePatch): Promise<CatalogPartidaPatchResult> {
  const patch = catalogPartidaStatePatchSchema.parse(patchInput);

  return prisma.$transaction(async (tx) => {
    const created: CatalogPartidaPatchResult["created"] = [];
    const updated: CatalogPartidaRecord[] = [];

    for (const entry of patch.create) {
      const normalized = normalizeCatalogPartidaFields(catalogPartidaSchema.parse(entry.data));
      const partida = await tx.catalogPartida.create({
        data: buildCatalogPartidaCreateData(normalized),
        include: {
          apuRows: {
            orderBy: { sortOrder: "asc" },
            include: {
              catalogSubpartida: {
                include: {
                  apuRows: {
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      });

      created.push({
        clientId: entry.clientId,
        partida: serializeCatalogPartida(partida),
      });
    }

    for (const entry of patch.update) {
      const existing = await tx.catalogPartida.findUnique({
        where: { id: entry.id },
        include: {
          apuRows: {
            orderBy: { sortOrder: "asc" },
            include: {
              catalogSubpartida: {
                include: {
                  apuRows: {
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      });

      if (!existing) {
        throw new Error("La partida ya no existe");
      }

      const normalizedChanges = normalizeCatalogPartidaPatchChanges(entry.changes);
      const nextPerformance = normalizedChanges.performance ?? Number(existing.performance);
      const nextApuRows = calculateApuRows(
        (normalizedChanges.apuRows ?? existing.apuRows.map((row) => normalizeCatalogPartidaApuRow(row))),
        nextPerformance,
      );
      const nextUnitPrice = computeCatalogPartidaUnitPrice(nextApuRows, nextPerformance, normalizedChanges.unitPrice ?? Number(existing.unitPrice));
      const shouldRewriteApuRows = normalizedChanges.apuRows !== undefined || normalizedChanges.performance !== undefined;

      await tx.catalogPartida.update({
        where: { id: entry.id },
        data: {
          description: normalizedChanges.description ?? undefined,
          unit: normalizedChanges.unit ?? undefined,
          unitPrice: nextUnitPrice,
          currency: normalizedChanges.currency ?? undefined,
          source: normalizedChanges.source === undefined ? undefined : normalizedChanges.source,
          performance: normalizedChanges.performance ?? undefined,
          performanceUnit: normalizedChanges.performanceUnit === undefined ? undefined : normalizedChanges.performanceUnit,
          performanceRate: normalizedChanges.performanceRate === undefined ? undefined : normalizedChanges.performanceRate,
          apuRows:
            !shouldRewriteApuRows
              ? undefined
              : {
                  deleteMany: {},
                  create: createPartidaApuRowsData(nextApuRows),
                },
        },
      });

      const partida = await tx.catalogPartida.findUniqueOrThrow({
        where: { id: entry.id },
        include: {
          apuRows: {
            orderBy: { sortOrder: "asc" },
            include: {
              catalogSubpartida: {
                include: {
                  apuRows: {
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      });

      updated.push(serializeCatalogPartida(partida));
    }

    for (const id of patch.delete) {
      await tx.catalogPartida.delete({
        where: { id },
      });
    }

    return {
      created,
      updated,
      deleted: patch.delete,
      savedAt: new Date().toISOString(),
    };
  });
}

function normalizeCatalogPartidaFields(input: CatalogPartidaInput) {
  const apuRows = calculateCatalogPartidaApuRows(input.apuRows, input.performance);

  return {
    description: input.description.trim(),
    unit: input.unit.trim(),
    unitPrice: computeCatalogPartidaUnitPrice(apuRows, input.performance, input.unitPrice),
    currency: input.currency.trim() || "PEN",
    source: normalizeOptionalString(input.source),
    performance: input.performance,
    performanceUnit: normalizeOptionalString(input.performanceUnit),
    performanceRate: normalizeOptionalString(input.performanceRate),
    apuRows,
  };
}

function normalizeCatalogPartidaPatchChanges(input: Partial<CatalogPartidaInput>) {
  return {
    description: input.description === undefined ? undefined : input.description.trim(),
    unit: input.unit === undefined ? undefined : input.unit.trim(),
    unitPrice: input.unitPrice,
    currency: input.currency === undefined ? undefined : input.currency.trim() || "PEN",
    source: input.source === undefined ? undefined : normalizeOptionalString(input.source),
    performance: input.performance,
    performanceUnit: input.performanceUnit === undefined ? undefined : normalizeOptionalString(input.performanceUnit),
    performanceRate: input.performanceRate === undefined ? undefined : normalizeOptionalString(input.performanceRate),
    apuRows: input.apuRows?.map((row) => normalizeCatalogPartidaApuRow(row)),
  };
}

function normalizeCatalogPartidaApuRow(row: CatalogPartidaApuRowInput | {
  resourceId: string | null;
  catalogSubpartidaId?: string | null;
  description: string;
  unit: string;
  crew: number | { toString(): string } | null;
  quantity: number | { toString(): string };
  unitPrice: number | { toString(): string };
  subtotal: number | { toString(): string };
  resourceType: string | null;
  groupLabel: string | null;
  sortOrder: number;
}) {
  return {
    resourceId: normalizeOptionalString(row.resourceId),
    catalogSubpartidaId: normalizeOptionalString(row.catalogSubpartidaId),
    description: row.description.trim(),
    unit: row.unit.trim(),
    crew: row.crew == null ? null : Number(row.crew.toString()),
    quantity: Number(row.quantity.toString()),
    unitPrice: Number(row.unitPrice.toString()),
    subtotal: Number(row.subtotal.toString()),
    resourceType: normalizeOptionalString(row.resourceType),
    groupLabel: normalizeOptionalString(row.groupLabel),
    sortOrder: row.sortOrder,
  };
}

function buildCatalogPartidaCreateData(input: ReturnType<typeof normalizeCatalogPartidaFields>) {
  return {
    description: input.description,
    unit: input.unit,
    unitPrice: input.unitPrice,
    currency: input.currency,
    source: input.source,
    performance: input.performance,
    performanceUnit: input.performanceUnit,
    performanceRate: input.performanceRate,
    apuRows: {
      create: createPartidaApuRowsData(input.apuRows),
    },
  };
}

function createPartidaApuRowsData(rows: ReturnType<typeof normalizeCatalogPartidaApuRow>[]) {
  return rows.map((row, index) => ({
    resourceId: row.resourceId,
    catalogSubpartidaId: row.catalogSubpartidaId,
    description: row.description,
    unit: row.unit,
    crew: row.crew,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    subtotal: row.subtotal,
    resourceType: row.resourceType,
    groupLabel: row.groupLabel,
    sortOrder: row.sortOrder ?? index,
  }));
}

function computeCatalogPartidaUnitPrice(
  rows: Array<{ resourceType: string | null; crew: number | null; quantity: number; unitPrice: number; subtotal: number; unit: string }>,
  performance: number,
  fallback: number,
) {
  if (!rows.length) return fallback;
  return calculateApuTotalUnitCost(rows, performance);
}

function calculateCatalogPartidaApuRows(rows: CatalogPartidaInput["apuRows"], performance: number) {
  return calculateApuRows(rows.map((row) => normalizeCatalogPartidaApuRow(row)), performance);
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
