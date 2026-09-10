CREATE TABLE "knowledge_review_evidence_links" (
    "id" TEXT NOT NULL,
    "reviewEvidenceId" TEXT NOT NULL,
    "knowledgeEvidenceId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_review_evidence_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "knowledge_review_evidence_links_reviewEvidenceId_knowledgeEvidenceId_key" ON "knowledge_review_evidence_links"("reviewEvidenceId", "knowledgeEvidenceId");
CREATE INDEX "knowledge_review_evidence_links_companyId_projectId_createdAt_idx" ON "knowledge_review_evidence_links"("companyId", "projectId", "createdAt" DESC);
CREATE INDEX "knowledge_review_evidence_links_reviewEvidenceId_idx" ON "knowledge_review_evidence_links"("reviewEvidenceId");
CREATE INDEX "knowledge_review_evidence_links_knowledgeEvidenceId_idx" ON "knowledge_review_evidence_links"("knowledgeEvidenceId");
ALTER TABLE "knowledge_review_evidence_links" ADD CONSTRAINT "knowledge_review_evidence_links_knowledgeEvidenceId_fkey" FOREIGN KEY ("knowledgeEvidenceId") REFERENCES "knowledge_evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_review_evidence_links" ADD CONSTRAINT "knowledge_review_evidence_links_reviewEvidenceId_fkey" FOREIGN KEY ("reviewEvidenceId") REFERENCES "ReviewEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
