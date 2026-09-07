ALTER TABLE "knowledge_suppliers" ADD COLUMN "sourceId" TEXT;

CREATE INDEX "knowledge_suppliers_sourceId_idx" ON "knowledge_suppliers"("sourceId");

ALTER TABLE "knowledge_suppliers" ADD CONSTRAINT "knowledge_suppliers_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
