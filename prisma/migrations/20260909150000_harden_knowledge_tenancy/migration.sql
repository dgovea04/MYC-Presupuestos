ALTER TABLE "knowledge_sources" ADD COLUMN "companyId" TEXT;
ALTER TABLE "knowledge_sources" ADD COLUMN "projectId" TEXT;
ALTER TABLE "knowledge_sources" ADD COLUMN "createdById" TEXT;

ALTER TABLE "knowledge_evidence" ADD COLUMN "companyId" TEXT;
ALTER TABLE "knowledge_evidence" ADD COLUMN "projectId" TEXT;
ALTER TABLE "knowledge_evidence" ADD COLUMN "createdById" TEXT;

CREATE INDEX "knowledge_sources_companyId_projectId_createdAt_idx" ON "knowledge_sources"("companyId", "projectId", "createdAt" DESC);
CREATE INDEX "knowledge_evidence_companyId_projectId_createdAt_idx" ON "knowledge_evidence"("companyId", "projectId", "createdAt" DESC);
