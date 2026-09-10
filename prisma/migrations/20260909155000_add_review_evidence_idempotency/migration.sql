ALTER TABLE "knowledge_sources" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "knowledge_sources_idempotencyKey_key" ON "knowledge_sources"("idempotencyKey");

ALTER TABLE "knowledge_evidence" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "knowledge_evidence_idempotencyKey_key" ON "knowledge_evidence"("idempotencyKey");
