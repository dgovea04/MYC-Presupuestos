-- AlterTable
ALTER TABLE "knowledge_canonical_items" ADD COLUMN     "evidenceId" TEXT,
ADD COLUMN     "sourceId" TEXT;

-- AlterTable
ALTER TABLE "knowledge_canonical_resources" ADD COLUMN     "evidenceId" TEXT,
ADD COLUMN     "sourceId" TEXT;

-- CreateIndex
CREATE INDEX "knowledge_canonical_items_sourceId_idx" ON "knowledge_canonical_items"("sourceId");

-- CreateIndex
CREATE INDEX "knowledge_canonical_items_evidenceId_idx" ON "knowledge_canonical_items"("evidenceId");

-- CreateIndex
CREATE INDEX "knowledge_canonical_resources_sourceId_idx" ON "knowledge_canonical_resources"("sourceId");

-- CreateIndex
CREATE INDEX "knowledge_canonical_resources_evidenceId_idx" ON "knowledge_canonical_resources"("evidenceId");

-- AddForeignKey
ALTER TABLE "knowledge_canonical_items" ADD CONSTRAINT "knowledge_canonical_items_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_canonical_items" ADD CONSTRAINT "knowledge_canonical_items_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "knowledge_evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_canonical_resources" ADD CONSTRAINT "knowledge_canonical_resources_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_canonical_resources" ADD CONSTRAINT "knowledge_canonical_resources_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "knowledge_evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
