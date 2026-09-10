ALTER TABLE "knowledge_apu_versions" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "knowledge_apu_versions_idempotencyKey_key" ON "knowledge_apu_versions"("idempotencyKey");
ALTER TABLE "knowledge_apu_versions" ADD COLUMN "reviewFindingId" TEXT;
ALTER TABLE "knowledge_apu_versions" ADD COLUMN "reviewDecisionId" TEXT;
ALTER TABLE "knowledge_apu_versions" ADD COLUMN "createdById" TEXT;
ALTER TABLE "knowledge_apu_versions" ADD COLUMN "beforeSnapshot" JSONB;
ALTER TABLE "knowledge_apu_versions" ADD COLUMN "afterSnapshot" JSONB;
CREATE INDEX "knowledge_apu_versions_reviewFindingId_idx" ON "knowledge_apu_versions"("reviewFindingId");
CREATE INDEX "knowledge_apu_versions_reviewDecisionId_idx" ON "knowledge_apu_versions"("reviewDecisionId");
