-- CreateTable
CREATE TABLE "knowledge_canonical_item_provenance" (
    "id" TEXT NOT NULL,
    "canonicalItemId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_canonical_item_provenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_canonical_resource_provenance" (
    "id" TEXT NOT NULL,
    "canonicalResourceId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_canonical_resource_provenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_canonical_item_provenance_idempotencyKey_key" ON "knowledge_canonical_item_provenance"("idempotencyKey");

-- CreateIndex
CREATE INDEX "knowledge_canonical_item_provenance_sourceId_idx" ON "knowledge_canonical_item_provenance"("sourceId");

-- CreateIndex
CREATE INDEX "knowledge_canonical_item_provenance_evidenceId_idx" ON "knowledge_canonical_item_provenance"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_canonical_item_provenance_canonicalItemId_evidenc_key" ON "knowledge_canonical_item_provenance"("canonicalItemId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_canonical_resource_provenance_idempotencyKey_key" ON "knowledge_canonical_resource_provenance"("idempotencyKey");

-- CreateIndex
CREATE INDEX "knowledge_canonical_resource_provenance_sourceId_idx" ON "knowledge_canonical_resource_provenance"("sourceId");

-- CreateIndex
CREATE INDEX "knowledge_canonical_resource_provenance_evidenceId_idx" ON "knowledge_canonical_resource_provenance"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_canonical_resource_provenance_canonicalResourceId_key" ON "knowledge_canonical_resource_provenance"("canonicalResourceId", "evidenceId");

-- AddForeignKey
ALTER TABLE "knowledge_canonical_item_provenance" ADD CONSTRAINT "knowledge_canonical_item_provenance_canonicalItemId_fkey" FOREIGN KEY ("canonicalItemId") REFERENCES "knowledge_canonical_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_canonical_item_provenance" ADD CONSTRAINT "knowledge_canonical_item_provenance_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_canonical_item_provenance" ADD CONSTRAINT "knowledge_canonical_item_provenance_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "knowledge_evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_canonical_resource_provenance" ADD CONSTRAINT "knowledge_canonical_resource_provenance_canonicalResourceI_fkey" FOREIGN KEY ("canonicalResourceId") REFERENCES "knowledge_canonical_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_canonical_resource_provenance" ADD CONSTRAINT "knowledge_canonical_resource_provenance_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_canonical_resource_provenance" ADD CONSTRAINT "knowledge_canonical_resource_provenance_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "knowledge_evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_apu_versions" ADD CONSTRAINT "knowledge_apu_versions_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_apu_versions" ADD CONSTRAINT "knowledge_apu_versions_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "knowledge_evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
