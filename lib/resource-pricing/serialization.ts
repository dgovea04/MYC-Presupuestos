import type { ResourcePricePreviewItem, ResourcePriceRequestSummary } from "@/types/resource-pricing";

export function serializeResourcePriceRequest(request: {
  id: string;
  mode: string;
  provider: string;
  status: string;
  resourceCount: number;
  matchedCount: number;
  changedCount: number;
  errorCount: number;
  errorMessage: string | null;
  idempotencyKey: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}): ResourcePriceRequestSummary {
  return {
    id: request.id,
    mode: request.mode as ResourcePriceRequestSummary["mode"],
    provider: request.provider as ResourcePriceRequestSummary["provider"],
    status: request.status as ResourcePriceRequestSummary["status"],
    resourceCount: request.resourceCount,
    matchedCount: request.matchedCount,
    changedCount: request.changedCount,
    errorCount: request.errorCount,
    errorMessage: request.errorMessage,
    idempotencyKey: request.idempotencyKey,
    startedAt: request.startedAt?.toISOString() ?? null,
    completedAt: request.completedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
  };
}

export function serializeResourcePriceItem(item: {
  id: string;
  resourceId: string | null;
  externalResourceId: string | null;
  status: string;
  oldPrice: { toString(): string } | null;
  newPrice: { toString(): string } | null;
  oldCurrency: string | null;
  newCurrency: string | null;
  oldUnit: string | null;
  newUnit: string | null;
  priceDelta: { toString(): string } | null;
  priceDeltaPercent: { toString(): string } | null;
  matchConfidence: { toString(): string } | null;
  reason: string | null;
  appliedAt: Date | null;
  resource?: { description: string; code: string } | null;
}): ResourcePricePreviewItem {
  return {
    id: item.id,
    resourceId: item.resourceId,
    externalResourceId: item.externalResourceId,
    status: item.status as ResourcePricePreviewItem["status"],
    oldPrice: item.oldPrice?.toString() ?? null,
    newPrice: item.newPrice?.toString() ?? null,
    oldCurrency: item.oldCurrency,
    newCurrency: item.newCurrency,
    oldUnit: item.oldUnit,
    newUnit: item.newUnit,
    priceDelta: item.priceDelta?.toString() ?? null,
    priceDeltaPercent: item.priceDeltaPercent?.toString() ?? null,
    matchConfidence: item.matchConfidence?.toString() ?? null,
    reason: item.reason,
    appliedAt: item.appliedAt?.toISOString() ?? null,
    description: item.resource?.description,
    code: item.resource?.code,
  };
}
