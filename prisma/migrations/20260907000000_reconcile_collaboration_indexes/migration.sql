-- Reconcile indexes that were created manually while the collaboration
-- integration migrations were being repaired. All statements are idempotent
-- so this migration is safe against the existing development database.
CREATE INDEX IF NOT EXISTS "collaboration_comments_companyId_budgetId_createdAt_idx"
  ON "collaboration_comments"("companyId", "budgetId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "budget_change_events_companyId_requestId_idx"
  ON "budget_change_events"("companyId", "requestId");

CREATE INDEX IF NOT EXISTS "integration_sessions_companyId_createdAt_idx"
  ON "integration_sessions"("companyId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "private_learning_examples_companyId_signalType_createdAt_idx"
  ON "private_learning_examples"("companyId", "signalType", "createdAt" DESC);

DROP INDEX IF EXISTS "private_learning_usages_companyId_createdAt_idx";
CREATE INDEX "private_learning_usages_companyId_createdAt_idx"
  ON "private_learning_usages"("companyId", "createdAt" DESC);
