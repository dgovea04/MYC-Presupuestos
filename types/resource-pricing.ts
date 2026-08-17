export type ResourcePriceProviderName = "mc-presupuestos-price-api" | "fake";
export type ResourcePriceProviderStatus = "DISABLED" | "HEALTHY" | "DEGRADED" | "SUSPENDED";
export type ResourcePriceRequestMode = "ON_DEMAND" | "SCHEDULED" | "WEBHOOK";
export type ResourcePriceRequestStatus =
  | "QUEUED"
  | "RUNNING"
  | "PREVIEW_READY"
  | "APPLIED"
  | "PARTIALLY_APPLIED"
  | "REJECTED"
  | "FAILED"
  | "CANCELED";
export type ResourcePriceUpdateItemStatus =
  | "MATCHED"
  | "UPDATED"
  | "UNCHANGED"
  | "UNMATCHED"
  | "UNIT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "INVALID_PRICE"
  | "STALE"
  | "CONFLICT"
  | "APPLIED"
  | "REJECTED"
  | "ERROR";

export type ResourcePriceUpdateRequestInput = {
  resourceIds?: string[];
  mode?: ResourcePriceRequestMode;
  idempotencyKey?: string;
};

export type ResourcePriceLookup = {
  externalResourceId?: string | null;
  externalCode?: string | null;
  code?: string | null;
  description: string;
  category?: string | null;
  unit: string;
  currency: string;
  currentPrice?: string;
};

export type ResourcePriceQuote = {
  externalResourceId: string | null;
  externalCode: string | null;
  description: string;
  category: string | null;
  unit: string;
  currency: string;
  price: string;
  observedAt: string;
  sourceLabel: string;
  sourceVersion?: string | null;
  rawHash: string;
};

export type ResourcePricePreviewItem = {
  id: string;
  resourceId: string | null;
  externalResourceId: string | null;
  status: ResourcePriceUpdateItemStatus;
  oldPrice: string | null;
  newPrice: string | null;
  oldCurrency: string | null;
  newCurrency: string | null;
  oldUnit: string | null;
  newUnit: string | null;
  priceDelta: string | null;
  priceDeltaPercent: string | null;
  matchConfidence: string | null;
  reason: string | null;
  appliedAt: string | null;
  description?: string;
  code?: string;
};

export type ResourcePriceRequestSummary = {
  id: string;
  mode: ResourcePriceRequestMode;
  provider: ResourcePriceProviderName;
  status: ResourcePriceRequestStatus;
  resourceCount: number;
  matchedCount: number;
  changedCount: number;
  errorCount: number;
  errorMessage: string | null;
  idempotencyKey: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ResourcePriceProviderConfigPublic = {
  provider: ResourcePriceProviderName;
  status: ResourcePriceProviderStatus;
  baseUrl: string | null;
  apiVersion: string;
  credentialConfigured: boolean;
  credentialMasked: string;
  timeoutMs: number;
  maxBatchSize: number;
  defaultTtlHours: number;
  allowFallback: boolean;
  lastHealthCheckAt: string | null;
  lastHealthStatus: string | null;
};

export type ResourcePriceStreamEvent =
  | { type: "request.started"; requestId: string }
  | { type: "request.progress"; requestId: string; completed: number; total: number }
  | { type: "preview.ready"; requestId: string }
  | { type: "request.failed"; requestId: string; message: string }
  | { type: "request.applied"; requestId: string; appliedCount: number };
