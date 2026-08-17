CREATE TYPE "LocalResourcePriceBatchStatus" AS ENUM ('DRAFT', 'PREVIEW_READY', 'PUBLISHED', 'REJECTED', 'ROLLED_BACK');
CREATE TYPE "LocalResourcePriceBatchSource" AS ENUM ('EXCEL', 'MANUAL', 'ROLLBACK');
CREATE TYPE "LocalResourcePriceItemStatus" AS ENUM ('VALID', 'INVALID', 'UNCHANGED', 'UPDATED', 'CONFLICT', 'APPLIED', 'REJECTED');

CREATE TABLE "local_resource_price_batches" (
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "source" "LocalResourcePriceBatchSource" NOT NULL,
    "status" "LocalResourcePriceBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "fileName" TEXT,
    "fileHash" TEXT,
    "notes" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "changedRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "rolledBackById" TEXT,
    "previewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "local_resource_price_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "local_resource_price_batches_versionNumber_key" ON "local_resource_price_batches"("versionNumber");
CREATE UNIQUE INDEX "local_resource_price_batches_versionLabel_key" ON "local_resource_price_batches"("versionLabel");
CREATE INDEX "local_resource_price_batches_status_createdAt_idx" ON "local_resource_price_batches"("status", "createdAt" DESC);
CREATE INDEX "local_resource_price_batches_source_createdAt_idx" ON "local_resource_price_batches"("source", "createdAt" DESC);

CREATE TABLE "local_resource_price_batch_items" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "resourceId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "resourceCode" TEXT NOT NULL,
    "resourceDescription" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "proposedPrice" DECIMAL(18,4),
    "oldPrice" DECIMAL(18,4),
    "observedAt" TIMESTAMP(3),
    "sourceLabel" TEXT,
    "notes" TEXT,
    "status" "LocalResourcePriceItemStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "local_resource_price_batch_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "local_resource_price_batch_items_batchId_rowNumber_key" ON "local_resource_price_batch_items"("batchId", "rowNumber");
CREATE INDEX "local_resource_price_batch_items_batchId_status_idx" ON "local_resource_price_batch_items"("batchId", "status");
CREATE INDEX "local_resource_price_batch_items_resourceId_createdAt_idx" ON "local_resource_price_batch_items"("resourceId", "createdAt" DESC);

CREATE TABLE "local_resource_price_history" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "oldPrice" DECIMAL(18,4) NOT NULL,
    "newPrice" DECIMAL(18,4) NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "local_resource_price_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "local_resource_price_history_resourceId_changedAt_idx" ON "local_resource_price_history"("resourceId", "changedAt" DESC);
CREATE INDEX "local_resource_price_history_batchId_idx" ON "local_resource_price_history"("batchId");

ALTER TABLE "local_resource_price_batches" ADD CONSTRAINT "local_resource_price_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "local_resource_price_batches" ADD CONSTRAINT "local_resource_price_batches_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "local_resource_price_batches" ADD CONSTRAINT "local_resource_price_batches_rolledBackById_fkey" FOREIGN KEY ("rolledBackById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "local_resource_price_batch_items" ADD CONSTRAINT "local_resource_price_batch_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "local_resource_price_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "local_resource_price_batch_items" ADD CONSTRAINT "local_resource_price_batch_items_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "local_resource_price_history" ADD CONSTRAINT "local_resource_price_history_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "local_resource_price_history" ADD CONSTRAINT "local_resource_price_history_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "local_resource_price_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "local_resource_price_history" ADD CONSTRAINT "local_resource_price_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
