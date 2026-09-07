-- DropIndex
DROP INDEX "budget_change_events_companyId_requestId_idx";

-- DropIndex
DROP INDEX "collaboration_comments_companyId_budgetId_createdAt_idx";

-- RenameIndex
ALTER INDEX "private_learning_examples_companyId_contentHash_schemaVersion_k" RENAME TO "private_learning_examples_companyId_contentHash_schemaVersi_key";
