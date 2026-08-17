-- CreateEnum
CREATE TYPE "ResourcePriceProviderStatus" AS ENUM ('DISABLED', 'HEALTHY', 'DEGRADED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ResourcePriceRequestMode" AS ENUM ('ON_DEMAND', 'SCHEDULED', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "ResourcePriceRequestStatus" AS ENUM ('QUEUED', 'RUNNING', 'PREVIEW_READY', 'APPLIED', 'PARTIALLY_APPLIED', 'REJECTED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ResourcePriceUpdateItemStatus" AS ENUM ('MATCHED', 'UPDATED', 'UNCHANGED', 'UNMATCHED', 'UNIT_MISMATCH', 'CURRENCY_MISMATCH', 'INVALID_PRICE', 'STALE', 'CONFLICT', 'APPLIED', 'REJECTED', 'ERROR');

-- AlterTable
ALTER TABLE "Resource"
  ADD COLUMN "priceUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "priceObservedAt" TIMESTAMP(3),
  ADD COLUMN "priceSource" TEXT,
  ADD COLUMN "priceSyncStatus" TEXT;

-- CreateTable
CREATE TABLE "resource_price_provider_configs" (
    "id" TEXT NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'primary',
    "provider" TEXT NOT NULL,
    "status" "ResourcePriceProviderStatus" NOT NULL DEFAULT 'DISABLED',
    "baseUrl" TEXT,
    "apiVersion" TEXT NOT NULL DEFAULT 'v1',
    "credentialEncrypted" TEXT,
    "timeoutMs" INTEGER NOT NULL DEFAULT 8000,
    "maxBatchSize" INTEGER NOT NULL DEFAULT 50,
    "defaultTtlHours" INTEGER NOT NULL DEFAULT 24,
    "allowFallback" BOOLEAN NOT NULL DEFAULT false,
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastHealthStatus" TEXT,
    "lastUpdatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resource_price_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_price_bindings" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalResourceId" TEXT NOT NULL,
    "externalCode" TEXT,
    "externalUnit" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resource_price_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_price_snapshots" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT,
    "requestId" TEXT,
    "provider" TEXT NOT NULL,
    "externalResourceId" TEXT,
    "price" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawHash" TEXT NOT NULL,
    "rawPayload" JSONB,
    "status" "ResourcePriceUpdateItemStatus" NOT NULL DEFAULT 'MATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "resource_price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_price_update_requests" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT,
    "mode" "ResourcePriceRequestMode" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "ResourcePriceRequestStatus" NOT NULL DEFAULT 'QUEUED',
    "resourceCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "changedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resource_price_update_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_price_update_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "resourceId" TEXT,
    "externalResourceId" TEXT,
    "status" "ResourcePriceUpdateItemStatus" NOT NULL,
    "oldPrice" DECIMAL(18,4),
    "newPrice" DECIMAL(18,4),
    "oldCurrency" TEXT,
    "newCurrency" TEXT,
    "oldUnit" TEXT,
    "newUnit" TEXT,
    "priceDelta" DECIMAL(18,4),
    "priceDeltaPercent" DECIMAL(10,4),
    "matchConfidence" DECIMAL(5,4),
    "reason" TEXT,
    "appliedAt" TIMESTAMP(3),
    "appliedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resource_price_update_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resource_price_provider_configs_singletonKey_key" ON "resource_price_provider_configs"("singletonKey");
CREATE INDEX "resource_price_provider_configs_status_idx" ON "resource_price_provider_configs"("status");
CREATE INDEX "resource_price_provider_configs_provider_status_idx" ON "resource_price_provider_configs"("provider", "status");
CREATE UNIQUE INDEX "resource_price_bindings_provider_externalResourceId_key" ON "resource_price_bindings"("provider", "externalResourceId");
CREATE UNIQUE INDEX "resource_price_bindings_resourceId_provider_key" ON "resource_price_bindings"("resourceId", "provider");
CREATE INDEX "resource_price_bindings_resourceId_active_idx" ON "resource_price_bindings"("resourceId", "active");
CREATE INDEX "resource_price_bindings_provider_active_idx" ON "resource_price_bindings"("provider", "active");
CREATE INDEX "resource_price_snapshots_resourceId_observedAt_idx" ON "resource_price_snapshots"("resourceId", "observedAt" DESC);
CREATE INDEX "resource_price_snapshots_requestId_idx" ON "resource_price_snapshots"("requestId");
CREATE INDEX "resource_price_snapshots_provider_externalResourceId_idx" ON "resource_price_snapshots"("provider", "externalResourceId");
CREATE INDEX "resource_price_snapshots_observedAt_idx" ON "resource_price_snapshots"("observedAt" DESC);
CREATE UNIQUE INDEX "resource_price_update_requests_idempotencyKey_key" ON "resource_price_update_requests"("idempotencyKey");
CREATE INDEX "resource_price_update_requests_status_createdAt_idx" ON "resource_price_update_requests"("status", "createdAt" DESC);
CREATE INDEX "resource_price_update_requests_requestedById_createdAt_idx" ON "resource_price_update_requests"("requestedById", "createdAt" DESC);
CREATE INDEX "resource_price_update_requests_provider_createdAt_idx" ON "resource_price_update_requests"("provider", "createdAt" DESC);
CREATE INDEX "resource_price_update_items_requestId_status_idx" ON "resource_price_update_items"("requestId", "status");
CREATE INDEX "resource_price_update_items_resourceId_createdAt_idx" ON "resource_price_update_items"("resourceId", "createdAt" DESC);
CREATE INDEX "resource_price_update_items_externalResourceId_idx" ON "resource_price_update_items"("externalResourceId");
CREATE INDEX "Resource_priceSyncStatus_priceObservedAt_idx" ON "Resource"("priceSyncStatus", "priceObservedAt");

-- AddForeignKey
ALTER TABLE "resource_price_provider_configs" ADD CONSTRAINT "resource_price_provider_configs_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resource_price_bindings" ADD CONSTRAINT "resource_price_bindings_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_price_snapshots" ADD CONSTRAINT "resource_price_snapshots_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resource_price_snapshots" ADD CONSTRAINT "resource_price_snapshots_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "resource_price_update_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resource_price_update_requests" ADD CONSTRAINT "resource_price_update_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resource_price_update_items" ADD CONSTRAINT "resource_price_update_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "resource_price_update_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_price_update_items" ADD CONSTRAINT "resource_price_update_items_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resource_price_update_items" ADD CONSTRAINT "resource_price_update_items_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
