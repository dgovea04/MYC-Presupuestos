-- CreateEnum
CREATE TYPE "KnowledgeScope" AS ENUM ('GLOBAL', 'COMPANY', 'PROJECT', 'USER');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('OBSERVED', 'CONFIRMED', 'VERIFIED', 'CANONICAL', 'DEPRECATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KnowledgeConfidence" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "privacy" TEXT NOT NULL DEFAULT 'PRIVATE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_evidence" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "documentId" TEXT,
    "fileName" TEXT,
    "page" TEXT,
    "sheet" TEXT,
    "cellRange" TEXT,
    "url" TEXT,
    "quote" TEXT,
    "checksum" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "scope" "KnowledgeScope" NOT NULL,
    "companyId" TEXT,
    "projectId" TEXT,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "evidenceId" TEXT,
    "metadata" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_canonical_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "canonicalUnit" TEXT,
    "classification" TEXT,
    "specialty" TEXT,
    "scope" "KnowledgeScope" NOT NULL DEFAULT 'GLOBAL',
    "companyId" TEXT,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'OBSERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_canonical_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_canonical_item_aliases" (
    "id" TEXT NOT NULL,
    "canonicalItemId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "knowledge_canonical_item_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_canonical_resources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "canonicalUnit" TEXT,
    "scope" "KnowledgeScope" NOT NULL DEFAULT 'GLOBAL',
    "companyId" TEXT,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'OBSERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_canonical_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_canonical_resource_aliases" (
    "id" TEXT NOT NULL,
    "canonicalResourceId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "knowledge_canonical_resource_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_apu_versions" (
    "id" TEXT NOT NULL,
    "apuId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "performance" DECIMAL(18,4) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "scope" "KnowledgeScope" NOT NULL,
    "companyId" TEXT,
    "projectId" TEXT,
    "sourceId" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_apu_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_apu_resources" (
    "id" TEXT NOT NULL,
    "apuVersionId" TEXT NOT NULL,
    "resourceId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "resourceType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "knowledge_apu_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_regions" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "ruc" TEXT,
    "regionId" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_price_observations" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "regionId" TEXT,
    "supplierId" TEXT,
    "companyId" TEXT,
    "projectId" TEXT,
    "sourceId" TEXT,
    "evidenceId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "scope" "KnowledgeScope" NOT NULL,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'OBSERVED',
    "confidence" "KnowledgeConfidence" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_price_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_yield_observations" (
    "id" TEXT NOT NULL,
    "canonicalItemId" TEXT NOT NULL,
    "apuVersionId" TEXT,
    "value" DECIMAL(18,6) NOT NULL,
    "unit" TEXT NOT NULL,
    "crew" DECIMAL(18,4),
    "projectType" TEXT,
    "regionId" TEXT,
    "companyId" TEXT,
    "projectId" TEXT,
    "sourceId" TEXT,
    "evidenceId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "scope" "KnowledgeScope" NOT NULL,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'OBSERVED',
    "confidence" "KnowledgeConfidence" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_yield_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_assertions" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "scope" "KnowledgeScope" NOT NULL,
    "status" "KnowledgeStatus" NOT NULL,
    "confidence" "KnowledgeConfidence" NOT NULL,
    "companyId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_assertions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_sources_sourceType_createdAt_idx" ON "knowledge_sources"("sourceType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_evidence_sourceId_createdAt_idx" ON "knowledge_evidence"("sourceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_evidence_checksum_idx" ON "knowledge_evidence"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_events_idempotencyKey_key" ON "knowledge_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "knowledge_events_entityType_entityId_createdAt_idx" ON "knowledge_events"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_events_scope_companyId_projectId_createdAt_idx" ON "knowledge_events"("scope", "companyId", "projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_events_eventType_createdAt_idx" ON "knowledge_events"("eventType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_canonical_items_normalizedName_idx" ON "knowledge_canonical_items"("normalizedName");

-- CreateIndex
CREATE INDEX "knowledge_canonical_items_scope_companyId_normalizedName_idx" ON "knowledge_canonical_items"("scope", "companyId", "normalizedName");

-- CreateIndex
CREATE INDEX "knowledge_canonical_item_aliases_normalizedAlias_idx" ON "knowledge_canonical_item_aliases"("normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_canonical_item_aliases_canonicalItemId_normalized_key" ON "knowledge_canonical_item_aliases"("canonicalItemId", "normalizedAlias");

-- CreateIndex
CREATE INDEX "knowledge_canonical_resources_normalizedName_idx" ON "knowledge_canonical_resources"("normalizedName");

-- CreateIndex
CREATE INDEX "knowledge_canonical_resources_scope_companyId_normalizedNam_idx" ON "knowledge_canonical_resources"("scope", "companyId", "normalizedName");

-- CreateIndex
CREATE INDEX "knowledge_canonical_resource_aliases_normalizedAlias_idx" ON "knowledge_canonical_resource_aliases"("normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_canonical_resource_aliases_canonicalResourceId_no_key" ON "knowledge_canonical_resource_aliases"("canonicalResourceId", "normalizedAlias");

-- CreateIndex
CREATE INDEX "knowledge_apu_versions_apuId_createdAt_idx" ON "knowledge_apu_versions"("apuId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_apu_versions_scope_companyId_projectId_idx" ON "knowledge_apu_versions"("scope", "companyId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_apu_versions_apuId_versionNumber_key" ON "knowledge_apu_versions"("apuId", "versionNumber");

-- CreateIndex
CREATE INDEX "knowledge_apu_resources_apuVersionId_sortOrder_idx" ON "knowledge_apu_resources"("apuVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "knowledge_apu_resources_resourceId_idx" ON "knowledge_apu_resources"("resourceId");

-- CreateIndex
CREATE INDEX "knowledge_regions_parentId_idx" ON "knowledge_regions"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_regions_level_normalizedName_parentId_key" ON "knowledge_regions"("level", "normalizedName", "parentId");

-- CreateIndex
CREATE INDEX "knowledge_suppliers_ruc_idx" ON "knowledge_suppliers"("ruc");

-- CreateIndex
CREATE INDEX "knowledge_suppliers_regionId_idx" ON "knowledge_suppliers"("regionId");

-- CreateIndex
CREATE INDEX "knowledge_price_observations_resourceId_observedAt_idx" ON "knowledge_price_observations"("resourceId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_price_observations_scope_companyId_projectId_obse_idx" ON "knowledge_price_observations"("scope", "companyId", "projectId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_price_observations_regionId_observedAt_idx" ON "knowledge_price_observations"("regionId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_yield_observations_canonicalItemId_observedAt_idx" ON "knowledge_yield_observations"("canonicalItemId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_yield_observations_scope_companyId_projectId_obse_idx" ON "knowledge_yield_observations"("scope", "companyId", "projectId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_assertions_subjectId_predicate_idx" ON "knowledge_assertions"("subjectId", "predicate");

-- CreateIndex
CREATE INDEX "knowledge_assertions_scope_companyId_projectId_idx" ON "knowledge_assertions"("scope", "companyId", "projectId");

-- AddForeignKey
ALTER TABLE "knowledge_evidence" ADD CONSTRAINT "knowledge_evidence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_events" ADD CONSTRAINT "knowledge_events_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_events" ADD CONSTRAINT "knowledge_events_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "knowledge_evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_canonical_item_aliases" ADD CONSTRAINT "knowledge_canonical_item_aliases_canonicalItemId_fkey" FOREIGN KEY ("canonicalItemId") REFERENCES "knowledge_canonical_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_canonical_resource_aliases" ADD CONSTRAINT "knowledge_canonical_resource_aliases_canonicalResourceId_fkey" FOREIGN KEY ("canonicalResourceId") REFERENCES "knowledge_canonical_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_apu_resources" ADD CONSTRAINT "knowledge_apu_resources_apuVersionId_fkey" FOREIGN KEY ("apuVersionId") REFERENCES "knowledge_apu_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_regions" ADD CONSTRAINT "knowledge_regions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "knowledge_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_price_observations" ADD CONSTRAINT "knowledge_price_observations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_price_observations" ADD CONSTRAINT "knowledge_price_observations_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "knowledge_evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_yield_observations" ADD CONSTRAINT "knowledge_yield_observations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_yield_observations" ADD CONSTRAINT "knowledge_yield_observations_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "knowledge_evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;


