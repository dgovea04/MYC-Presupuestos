import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { publishResourcePriceEvent } from "@/lib/resource-pricing/events";
import { matchQuoteToResource } from "@/lib/resource-pricing/matching";
import { normalizePriceQuote, parsePrice } from "@/lib/resource-pricing/normalization";
import { resolvePrimaryResourcePriceProvider } from "@/lib/resource-pricing/provider-registry";
import type { ResourcePriceQuote, ResourcePriceUpdateRequestInput } from "@/types/resource-pricing";

export class ResourcePriceIdempotencyConflictError extends Error {
  constructor() {
    super("La clave de idempotencia ya pertenece a otra solicitud.");
    this.name = "ResourcePriceIdempotencyConflictError";
  }
}
import { serializeResourcePriceItem, serializeResourcePriceRequest } from "@/lib/resource-pricing/serialization";

export async function createResourcePriceUpdateRequest(userId: string | null, input: ResourcePriceUpdateRequestInput) {
  const idempotencyKey = input.idempotencyKey?.trim() || `resource-price:${userId ?? "system"}:${randomUUID()}`;
  const existing = await prisma.resourcePriceUpdateRequest.findUnique({
    where: { idempotencyKey },
    include: { items: { include: { resource: { select: { description: true, code: true } } } } },
  });
  if (existing) {
    const sameActor = existing.requestedById === userId;
    if (!sameActor) {
      throw new ResourcePriceIdempotencyConflictError();
    }

    return {
      request: serializeResourcePriceRequest(existing),
      items: existing.items.map(serializeResourcePriceItem),
      reused: true,
    };
  }

  const { provider, config } = await resolvePrimaryResourcePriceProvider();
  const resources = await prisma.resource.findMany({
    where: {
      companyId: null,
      ...(input.resourceIds?.length ? { id: { in: input.resourceIds } } : {}),
    },
    orderBy: [{ category: "asc" }, { description: "asc" }],
    take: 1000,
  });

  const request = await prisma.resourcePriceUpdateRequest.create({
    data: {
      requestedById: userId,
      mode: input.mode ?? "ON_DEMAND",
      provider: provider.name,
      status: "RUNNING",
      resourceCount: resources.length,
      idempotencyKey,
      startedAt: new Date(),
    },
  });
  publishResourcePriceEvent({ type: "request.started", requestId: request.id });

  try {
    const quotes: ResourcePriceQuote[] = [];
    for (let offset = 0; offset < resources.length; offset += config.maxBatchSize) {
      const batch = resources.slice(offset, offset + config.maxBatchSize);
      const batchQuotes = await provider.lookup(batch.map((resource) => ({
        externalResourceId: resource.iu ?? resource.id,
        externalCode: resource.code,
        code: resource.code,
        description: resource.description,
        category: resource.category,
        unit: resource.unit,
        currency: resource.currency,
        currentPrice: resource.unitPrice.toString(),
      })));
      quotes.push(...batchQuotes.map(normalizePriceQuote));
      publishResourcePriceEvent({
        type: "request.progress",
        requestId: request.id,
        completed: Math.min(offset + batch.length, resources.length),
        total: resources.length,
      });
    }

    const bindings = await prisma.resourcePriceBinding.findMany({
      where: { provider: provider.name, resourceId: { in: resources.map((resource) => resource.id) } },
      select: { resourceId: true, provider: true, externalResourceId: true, active: true },
    });
    const matches = matchQuoteToResource(resources, quotes, bindings, provider.name);
    const items: Array<{
      resourceId: string | null;
      externalResourceId: string | null;
      status: "UPDATED" | "UNCHANGED" | "UNMATCHED" | "UNIT_MISMATCH" | "CURRENCY_MISMATCH" | "INVALID_PRICE" | "STALE";
      oldPrice: Decimal | null;
      newPrice: Decimal | null;
      oldCurrency: string | null;
      newCurrency: string | null;
      oldUnit: string | null;
      newUnit: string | null;
      priceDelta: Decimal | null;
      priceDeltaPercent: Decimal | null;
      matchConfidence: Decimal | null;
      reason: string | null;
      snapshot?: { resourceId: string; provider: string; externalResourceId: string | null; price: Decimal; currency: string; unit: string; observedAt: Date; rawHash: string; status: "UPDATED" | "UNCHANGED" | "STALE" };
    }> = [];

    for (const match of matches) {
      const quote = match.quote;
      const resource = match.resource;
      if (!quote || !resource) {
        items.push({ resourceId: null, externalResourceId: null, status: "UNMATCHED", oldPrice: null, newPrice: null, oldCurrency: null, newCurrency: null, oldUnit: null, newUnit: null, priceDelta: null, priceDeltaPercent: null, matchConfidence: null, reason: match.reason });
        continue;
      }
      let newPrice: Decimal;
      try {
        newPrice = parsePrice(quote.price);
      } catch {
        items.push({ resourceId: resource.id, externalResourceId: quote.externalResourceId, status: "INVALID_PRICE", oldPrice: resource.unitPrice, newPrice: null, oldCurrency: resource.currency, newCurrency: quote.currency, oldUnit: resource.unit, newUnit: quote.unit, priceDelta: null, priceDeltaPercent: null, matchConfidence: match.confidence ? new Decimal(match.confidence) : null, reason: "El precio externo no es válido." });
        continue;
      }
      if (match.status !== "MATCHED") {
        items.push({ resourceId: resource.id, externalResourceId: quote.externalResourceId, status: match.status, oldPrice: resource.unitPrice, newPrice, oldCurrency: resource.currency, newCurrency: quote.currency, oldUnit: resource.unit, newUnit: quote.unit, priceDelta: null, priceDeltaPercent: null, matchConfidence: match.confidence ? new Decimal(match.confidence) : null, reason: match.reason });
        continue;
      }
      const observedAt = new Date(quote.observedAt);
      const stale = observedAt.getTime() < Date.now() - config.defaultTtlHours * 60 * 60 * 1000;
      const delta = newPrice.minus(resource.unitPrice);
      const deltaPercent = resource.unitPrice.isZero() ? null : delta.div(resource.unitPrice).mul(100);
      const status = stale ? "STALE" : delta.isZero() ? "UNCHANGED" : "UPDATED";
      items.push({
        resourceId: resource.id,
        externalResourceId: quote.externalResourceId,
        status,
        oldPrice: resource.unitPrice,
        newPrice,
        oldCurrency: resource.currency,
        newCurrency: quote.currency,
        oldUnit: resource.unit,
        newUnit: quote.unit,
        priceDelta: delta,
        priceDeltaPercent: deltaPercent,
        matchConfidence: match.confidence ? new Decimal(match.confidence) : null,
        reason: stale ? "La cotización supera el TTL configurado." : match.reason,
        snapshot: { resourceId: resource.id, provider: provider.name, externalResourceId: quote.externalResourceId, price: newPrice, currency: quote.currency, unit: quote.unit, observedAt, rawHash: quote.rawHash, status },
      });
    }

    const persisted = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const snapshot = item.snapshot;
        const snapshotRecord = snapshot
          ? await tx.resourcePriceSnapshot.create({ data: { requestId: request.id, ...snapshot } })
          : null;
        await tx.resourcePriceUpdateItem.create({
          data: {
            requestId: request.id,
            resourceId: item.resourceId,
            externalResourceId: item.externalResourceId,
            status: item.status,
            oldPrice: item.oldPrice,
            newPrice: item.newPrice,
            oldCurrency: item.oldCurrency,
            newCurrency: item.newCurrency,
            oldUnit: item.oldUnit,
            newUnit: item.newUnit,
            priceDelta: item.priceDelta,
            priceDeltaPercent: item.priceDeltaPercent,
            matchConfidence: item.matchConfidence,
            reason: item.reason,
          },
        });
        void snapshotRecord;
      }
      const matchedCount = items.filter((item) => ["UPDATED", "UNCHANGED", "STALE"].includes(item.status)).length;
      const changedCount = items.filter((item) => item.status === "UPDATED").length;
      const errorCount = items.filter((item) => !["UPDATED", "UNCHANGED", "STALE"].includes(item.status)).length;
      return tx.resourcePriceUpdateRequest.update({
        where: { id: request.id },
        data: { status: "PREVIEW_READY", matchedCount, changedCount, errorCount, completedAt: new Date() },
        include: { items: { include: { resource: { select: { description: true, code: true } } } } },
      });
    });

    publishResourcePriceEvent({ type: "preview.ready", requestId: request.id });
    return { request: serializeResourcePriceRequest(persisted), items: persisted.items.map(serializeResourcePriceItem), reused: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar el proveedor.";
    const failed = await prisma.resourcePriceUpdateRequest.update({ where: { id: request.id }, data: { status: "FAILED", errorMessage: message, completedAt: new Date() } });
    publishResourcePriceEvent({ type: "request.failed", requestId: request.id, message });
    throw Object.assign(new Error(message), { request: serializeResourcePriceRequest(failed) });
  }
}

export async function getResourcePriceUpdateRequest(id: string, userId: string, canReadAll = false) {
  return prisma.resourcePriceUpdateRequest.findFirst({
    where: { id, ...(canReadAll ? {} : { requestedById: userId }) },
    include: { items: { include: { resource: { select: { description: true, code: true } } }, orderBy: { createdAt: "asc" } } },
  });
}

export async function listResourcePriceUpdateItems(id: string, userId: string, canReadAll = false, limit = 50, cursor?: string, status?: string) {
  const request = await prisma.resourcePriceUpdateRequest.findFirst({ where: { id, ...(canReadAll ? {} : { requestedById: userId }) }, select: { id: true } });
  if (!request) return null;
  const items = await prisma.resourcePriceUpdateItem.findMany({
    where: { requestId: id, ...(status ? { status: status as never } : {}) },
    include: { resource: { select: { description: true, code: true } } },
    orderBy: { createdAt: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const next = items.length > limit ? items.pop()?.id ?? null : null;
  return { items: items.map(serializeResourcePriceItem), nextCursor: next };
}

export async function rejectResourcePriceUpdate(id: string, userId: string, canManage: boolean) {
  const request = await prisma.resourcePriceUpdateRequest.findFirst({ where: { id, ...(canManage ? {} : { requestedById: userId }) } });
  if (!request) throw new Error("Solicitud no encontrada.");
  if (!["QUEUED", "RUNNING", "PREVIEW_READY"].includes(request.status)) throw new Error("La solicitud ya no puede rechazarse.");
  return prisma.resourcePriceUpdateRequest.update({ where: { id }, data: { status: "REJECTED", completedAt: new Date(), items: { updateMany: { where: { status: { in: ["UPDATED", "UNCHANGED", "STALE"] } }, data: { status: "REJECTED" } } } } });
}

export function summarizeRequest(request: NonNullable<Awaited<ReturnType<typeof getResourcePriceUpdateRequest>>>) {
  return serializeResourcePriceRequest(request);
}

