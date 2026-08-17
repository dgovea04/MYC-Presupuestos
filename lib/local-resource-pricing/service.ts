import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAdminAudit } from "@/lib/data/admin-audit";
import { localResourcePriceRowSchema } from "@/lib/validations/local-resource-pricing";
import type {
  LocalResourcePriceBatchItemRecord,
  LocalResourcePriceBatchSource,
  LocalResourcePriceBatchSummary,
  LocalResourcePriceRowInput,
} from "@/types/local-resource-pricing";

const LOCAL_SOURCE_PREFIX = "LOCAL_";

type ResourceForMatch = {
  id: string;
  code: string;
  description: string;
  unit: string;
  currency: string;
  unitPrice: Prisma.Decimal;
};

export function normalizeMatchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseLocalPrice(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!/^\d+(\.\d{1,4})?$/.test(normalized)) throw new Error("El precio debe ser un decimal no negativo con hasta 4 decimales.");
  const price = new Decimal(normalized);
  if (!price.isFinite() || price.isNegative() || price.decimalPlaces() > 4) throw new Error("El precio no es válido.");
  return price;
}

export function matchLocalPriceRow(row: LocalResourcePriceRowInput, resources: ResourceForMatch[]) {
  if (row.resourceId) {
    const byId = resources.filter((resource) => resource.id === row.resourceId);
    if (byId.length === 1) return byId[0];
    return null;
  }
  const byCode = resources.filter((resource) => resource.code.trim().toLowerCase() === row.code.trim().toLowerCase());
  if (byCode.length === 1) return byCode[0];
  if (byCode.length > 1) return null;
  const description = normalizeMatchText(row.description);
  const unit = normalizeMatchText(row.unit);
  const fallback = resources.filter((resource) => normalizeMatchText(resource.description) === description && normalizeMatchText(resource.unit) === unit);
  return fallback.length === 1 ? fallback[0] : null;
}

export async function createLocalResourcePriceBatch(input: {
  actorUserId: string;
  source: Exclude<LocalResourcePriceBatchSource, "ROLLBACK">;
  rows: LocalResourcePriceRowInput[];
  fileName?: string | null;
  fileHash?: string | null;
  notes?: string | null;
}) {
  if (input.rows.length === 0 || input.rows.length > 5000) throw new Error("El lote debe contener entre 1 y 5000 filas.");
  const resources = await prisma.resource.findMany({
    where: { companyId: null },
    select: { id: true, code: true, description: true, unit: true, currency: true, unitPrice: true },
  });
  const resourceRows = resources as ResourceForMatch[];
  const seenResourceIds = new Set<string>();
  const prepared = input.rows.map((row, index) => prepareLocalItem(row, index + 2, resourceRows, seenResourceIds));
  const validRows = prepared.filter((item) => item.status !== "INVALID").length;
  const changedRows = prepared.filter((item) => item.status === "UPDATED").length;
  const invalidRows = prepared.length - validRows;

  const batch = await prisma.$transaction(async (tx) => {
    const latest = await tx.localResourcePriceBatch.findFirst({ orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    const versionLabel = buildVersionLabel(new Date(), versionNumber);
    const created = await tx.localResourcePriceBatch.create({
      data: {
        id: randomUUID(),
        versionNumber,
        versionLabel,
        source: input.source,
        status: "PREVIEW_READY",
        fileName: input.fileName ?? null,
        fileHash: input.fileHash ?? null,
        notes: input.notes ?? null,
        totalRows: prepared.length,
        validRows,
        changedRows,
        invalidRows,
        createdById: input.actorUserId,
        previewedAt: new Date(),
        items: {
          create: prepared.map((item) => ({
            rowNumber: item.rowNumber,
            resourceId: item.resourceId,
            resourceCode: item.resourceCode,
            resourceDescription: item.resourceDescription,
            unit: item.unit,
            currency: item.currency,
            proposedPrice: item.proposedPrice,
            oldPrice: item.oldPrice,
            observedAt: item.observedAt,
            sourceLabel: item.sourceLabel,
            notes: item.notes,
            status: item.status,
            reason: item.reason,
          })),
        },
      },
      include: { items: { orderBy: { rowNumber: "asc" } } },
    });
    await recordAdminAudit({
      actorUserId: input.actorUserId,
      targetUserId: null,
      targetEmail: "global-resource-catalog",
      action: "LOCAL_RESOURCE_PRICE_BATCH_PREVIEWED",
      detail: `Preview ${versionLabel}: ${changedRows} cambios y ${invalidRows} filas inválidas.`,
      metadata: { batchId: created.id, versionLabel, source: input.source, totalRows: prepared.length, changedRows, invalidRows },
    }, tx);
    return created;
  });

  return serializeBatchWithItems(batch);
}

export async function listLocalResourcePriceBatches(input: { status?: string; limit?: number } = {}) {
  const batches = await prisma.localResourcePriceBatch.findMany({
    where: input.status ? { status: input.status as never } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(input.limit ?? 25, 100),
  });
  return batches.map(serializeBatch);
}

export async function getLocalResourcePriceBatch(id: string) {
  const batch = await prisma.localResourcePriceBatch.findUnique({
    where: { id },
    include: { items: { include: { resource: { select: { description: true } } }, orderBy: { rowNumber: "asc" } }, historyEntries: true },
  });
  return batch ? serializeBatchWithItems(batch) : null;
}

export async function publishLocalResourcePriceBatch(input: { batchId: string; actorUserId: string; confirmVersion: string }) {
  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.localResourcePriceBatch.findUnique({ where: { id: input.batchId }, include: { items: true } });
    if (!batch) throw new Error("Lote local no encontrado.");
    if (batch.status !== "PREVIEW_READY" || batch.versionLabel !== input.confirmVersion) throw new Error("El lote no está listo o la versión confirmada no coincide.");
    const updates = batch.items.filter((item) => item.status === "UPDATED");
    if (updates.length === 0) throw new Error("El lote no contiene cambios válidos para publicar.");

    for (const item of updates) {
      if (!item.resourceId || item.oldPrice == null || item.proposedPrice == null) throw new Error(`La fila ${item.rowNumber} no tiene un recurso publicable.`);
      const resource = await tx.resource.findFirst({ where: { id: item.resourceId, companyId: null } });
      if (!resource) throw new Error(`El insumo de la fila ${item.rowNumber} ya no pertenece al catálogo global.`);
      if (new Decimal(resource.unitPrice.toString()).comparedTo(new Decimal(item.oldPrice.toString())) !== 0) throw new Error(`El precio del insumo ${resource.code} cambió después del preview. Genera un nuevo preview.`);
      if (resource.unit !== item.unit || resource.currency !== item.currency) throw new Error(`La unidad o moneda del insumo ${resource.code} cambió después del preview.`);
    }

    for (const item of updates) {
      const resource = await tx.resource.findUniqueOrThrow({ where: { id: item.resourceId as string } });
      await tx.localResourcePriceHistory.create({ data: { resourceId: resource.id, batchId: batch.id, oldPrice: resource.unitPrice, newPrice: item.proposedPrice as Prisma.Decimal, changedById: input.actorUserId } });
      await tx.resource.update({
        where: { id: resource.id },
        data: { unitPrice: item.proposedPrice as Prisma.Decimal, priceUpdatedAt: new Date(), priceObservedAt: item.observedAt ?? new Date(), priceSource: item.sourceLabel ?? `${LOCAL_SOURCE_PREFIX}${batch.source}`, priceSyncStatus: "FRESH" },
      });
      await tx.localResourcePriceBatchItem.update({ where: { id: item.id }, data: { status: "APPLIED" } });
    }
    const published = await tx.localResourcePriceBatch.update({ where: { id: batch.id }, data: { status: "PUBLISHED", publishedById: input.actorUserId, publishedAt: new Date() } });
    await recordAdminAudit({
      actorUserId: input.actorUserId,
      targetUserId: null,
      targetEmail: "global-resource-catalog",
      action: "LOCAL_RESOURCE_PRICE_BATCH_PUBLISHED",
      detail: `Versión ${batch.versionLabel} publicada: ${updates.length} precios.`,
      metadata: { batchId: batch.id, versionLabel: batch.versionLabel, changedRows: updates.length },
    }, tx);
    return published;
  });
  return serializeBatch(result);
}

export async function rejectLocalResourcePriceBatch(input: { batchId: string; actorUserId: string }) {
  const batch = await prisma.localResourcePriceBatch.findUnique({ where: { id: input.batchId } });
  if (!batch || batch.status !== "PREVIEW_READY") throw new Error("Solo un preview pendiente puede rechazarse.");
  const rejected = await prisma.$transaction(async (tx) => {
    const updated = await tx.localResourcePriceBatch.update({ where: { id: batch.id }, data: { status: "REJECTED" } });
    await tx.localResourcePriceBatchItem.updateMany({ where: { batchId: batch.id, status: { in: ["UPDATED", "UNCHANGED", "VALID"] } }, data: { status: "REJECTED" } });
    await recordAdminAudit({ actorUserId: input.actorUserId, targetUserId: null, targetEmail: "global-resource-catalog", action: "LOCAL_RESOURCE_PRICE_BATCH_REJECTED", detail: `Versión ${batch.versionLabel} rechazada.`, metadata: { batchId: batch.id } }, tx);
    return updated;
  });
  return serializeBatch(rejected);
}

export async function rollbackLocalResourcePriceBatch(input: { batchId: string; actorUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.localResourcePriceBatch.findUnique({ where: { id: input.batchId }, include: { historyEntries: true } });
    if (!target || target.status !== "PUBLISHED" || target.historyEntries.length === 0) throw new Error("Solo una versión publicada con historial puede revertirse.");
    for (const entry of target.historyEntries) {
      const resource = await tx.resource.findFirst({ where: { id: entry.resourceId, companyId: null } });
      if (!resource || new Decimal(resource.unitPrice.toString()).comparedTo(new Decimal(entry.newPrice.toString())) !== 0) throw new Error("No se puede revertir: uno de los precios fue modificado posteriormente.");
    }
    const latest = await tx.localResourcePriceBatch.findFirst({ orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    const versionLabel = buildVersionLabel(new Date(), versionNumber);
    const rollback = await tx.localResourcePriceBatch.create({ data: { id: randomUUID(), versionNumber, versionLabel, source: "ROLLBACK", status: "PUBLISHED", notes: `Rollback de ${target.versionLabel}`, totalRows: target.historyEntries.length, validRows: target.historyEntries.length, changedRows: target.historyEntries.length, invalidRows: 0, createdById: input.actorUserId, publishedById: input.actorUserId, publishedAt: new Date() } });
    for (const entry of target.historyEntries) {
      const resource = await tx.resource.findUniqueOrThrow({ where: { id: entry.resourceId } });
      await tx.localResourcePriceBatchItem.create({ data: { batchId: rollback.id, resourceId: resource.id, rowNumber: target.historyEntries.indexOf(entry) + 2, resourceCode: resource.code, resourceDescription: resource.description, unit: resource.unit, currency: resource.currency, proposedPrice: entry.oldPrice, oldPrice: resource.unitPrice, status: "APPLIED", reason: `Rollback de ${target.versionLabel}` } });
      await tx.localResourcePriceHistory.create({ data: { resourceId: resource.id, batchId: rollback.id, oldPrice: resource.unitPrice, newPrice: entry.oldPrice, changedById: input.actorUserId } });
      await tx.resource.update({ where: { id: resource.id }, data: { unitPrice: entry.oldPrice, priceUpdatedAt: new Date(), priceSource: `${LOCAL_SOURCE_PREFIX}ROLLBACK`, priceSyncStatus: "FRESH" } });
    }
    await tx.localResourcePriceBatch.update({ where: { id: target.id }, data: { status: "ROLLED_BACK", rolledBackById: input.actorUserId, rolledBackAt: new Date() } });
    await recordAdminAudit({ actorUserId: input.actorUserId, targetUserId: null, targetEmail: "global-resource-catalog", action: "LOCAL_RESOURCE_PRICE_BATCH_ROLLED_BACK", detail: `Versión ${target.versionLabel} revertida mediante ${versionLabel}.`, metadata: { batchId: target.id, rollbackBatchId: rollback.id } }, tx);
    return serializeBatch(rollback);
  });
}

type PreparedItem = {
  rowNumber: number;
  resourceId: string | null;
  resourceCode: string;
  resourceDescription: string;
  unit: string;
  currency: string;
  proposedPrice: Decimal | null;
  oldPrice: Prisma.Decimal | null;
  observedAt: Date | null;
  sourceLabel: string | null;
  notes: string | null;
  status: "VALID" | "INVALID" | "UNCHANGED" | "UPDATED";
  reason: string | null;
};

function prepareLocalItem(row: LocalResourcePriceRowInput, rowNumber: number, resources: ResourceForMatch[], seen: Set<string>): PreparedItem {
  const parsed = localResourcePriceRowSchema.safeParse(row);
  const base = { rowNumber, resourceId: null, resourceCode: row.code, resourceDescription: row.description, unit: row.unit, currency: row.currency, proposedPrice: null, oldPrice: null, observedAt: toDate(row.observedAt), sourceLabel: row.sourceLabel ?? null, notes: row.notes ?? null };
  if (!parsed.success) return { ...base, status: "INVALID", reason: parsed.error.issues.map((issue) => issue.message).join("; ") };
  let price: Decimal;
  try { price = parseLocalPrice(row.proposedPrice); } catch (error) { return { ...base, status: "INVALID", reason: error instanceof Error ? error.message : "Precio inválido." }; }
  const resource = matchLocalPriceRow(row, resources);
  if (!resource) return { ...base, proposedPrice: price, status: "INVALID", reason: "No se encontró un insumo global único por ID, código o descripción/unidad." };
  if (seen.has(resource.id)) return { ...base, resourceId: resource.id, proposedPrice: price, oldPrice: resource.unitPrice, status: "INVALID", reason: "El mismo insumo aparece más de una vez en el lote." };
  seen.add(resource.id);
  if (resource.unit !== row.unit) return { ...base, resourceId: resource.id, proposedPrice: price, oldPrice: resource.unitPrice, status: "INVALID", reason: `Unidad incompatible: catálogo ${resource.unit}, archivo ${row.unit}.` };
  if (resource.currency !== row.currency) return { ...base, resourceId: resource.id, proposedPrice: price, oldPrice: resource.unitPrice, status: "INVALID", reason: `Moneda incompatible: catálogo ${resource.currency}, archivo ${row.currency}.` };
  const unchanged = new Decimal(resource.unitPrice.toString()).comparedTo(price) === 0;
  return { ...base, resourceId: resource.id, proposedPrice: price, oldPrice: resource.unitPrice, status: unchanged ? "UNCHANGED" : "UPDATED", reason: unchanged ? "El precio coincide con el catálogo actual." : null };
}

function toDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildVersionLabel(date: Date, versionNumber: number) {
  return `${date.toISOString().slice(0, 10).replace(/-/g, "")}-${String(versionNumber).padStart(3, "0")}`;
}

function serializeBatch(batch: {
  id: string; versionNumber: number; versionLabel: string; source: string; status: string; fileName: string | null; fileHash: string | null; notes: string | null; totalRows: number; validRows: number; changedRows: number; invalidRows: number; createdById: string; publishedById: string | null; rolledBackById: string | null; previewedAt?: Date | null; publishedAt: Date | null; rolledBackAt: Date | null; createdAt: Date; updatedAt: Date;
}): LocalResourcePriceBatchSummary {
  return { id: batch.id, versionNumber: batch.versionNumber, versionLabel: batch.versionLabel, source: batch.source as LocalResourcePriceBatchSummary["source"], status: batch.status as LocalResourcePriceBatchSummary["status"], fileName: batch.fileName, fileHash: batch.fileHash, notes: batch.notes, totalRows: batch.totalRows, validRows: batch.validRows, changedRows: batch.changedRows, invalidRows: batch.invalidRows, createdById: batch.createdById, publishedById: batch.publishedById, rolledBackById: batch.rolledBackById, previewedAt: batch.previewedAt?.toISOString() ?? null, publishedAt: batch.publishedAt?.toISOString() ?? null, rolledBackAt: batch.rolledBackAt?.toISOString() ?? null, createdAt: batch.createdAt.toISOString(), updatedAt: batch.updatedAt.toISOString() };
}

function serializeBatchWithItems(batch: Parameters<typeof serializeBatch>[0] & { items: Array<{ id: string; batchId: string; resourceId: string | null; rowNumber: number; resourceCode: string; resourceDescription: string; unit: string; currency: string; proposedPrice: Prisma.Decimal | null; oldPrice: Prisma.Decimal | null; observedAt: Date | null; sourceLabel: string | null; notes: string | null; status: string; reason: string | null; resource?: { description: string } | null }> }) {
  return { batch: serializeBatch(batch), items: batch.items.map((item): LocalResourcePriceBatchItemRecord => ({ id: item.id, batchId: item.batchId, resourceId: item.resourceId, rowNumber: item.rowNumber, resourceCode: item.resourceCode, resourceDescription: item.resourceDescription, unit: item.unit, currency: item.currency, proposedPrice: item.proposedPrice?.toString() ?? null, oldPrice: item.oldPrice?.toString() ?? null, observedAt: item.observedAt?.toISOString() ?? null, sourceLabel: item.sourceLabel, notes: item.notes, status: item.status as LocalResourcePriceBatchItemRecord["status"], reason: item.reason, description: item.resource?.description })) };
}
