-- DropIndex
DROP INDEX "knowledge_apu_versions_reviewDecisionId_idx";

-- DropIndex
DROP INDEX "knowledge_apu_versions_reviewFindingId_idx";

-- DropIndex
DROP INDEX "knowledge_assertions_companyId_projectId_status_idx";

-- DropIndex
DROP INDEX "knowledge_integration_jobs_status_nextRetryAt_idx";

-- RenameIndex
ALTER INDEX "knowledge_assertion_conflicts_assertionId_conflictingAssertionI" RENAME TO "knowledge_assertion_conflicts_assertionId_conflictingAssert_key";

-- RenameIndex
ALTER INDEX "knowledge_integration_jobs_companyId_projectId_status_nextRetry" RENAME TO "knowledge_integration_jobs_companyId_projectId_status_nextR_idx";

-- RenameIndex
ALTER INDEX "knowledge_review_evidence_links_companyId_projectId_createdAt_i" RENAME TO "knowledge_review_evidence_links_companyId_projectId_created_idx";

-- RenameIndex
ALTER INDEX "knowledge_review_evidence_links_reviewEvidenceId_knowledgeEvide" RENAME TO "knowledge_review_evidence_links_reviewEvidenceId_knowledgeE_key";
