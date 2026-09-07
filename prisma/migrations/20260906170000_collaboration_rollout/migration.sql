ALTER TYPE "CollaborationEntityType" ADD VALUE IF NOT EXISTS 'METRADO';
ALTER TYPE "CollaborationEntityType" ADD VALUE IF NOT EXISTS 'REVIEW_FINDING';
ALTER TYPE "CollaborationChangeSource" ADD VALUE IF NOT EXISTS 'INTEGRATION';

-- Collaboration already existed before this rollout. This migration is intentionally additive.
CREATE INDEX IF NOT EXISTS "collaboration_comments_companyId_budgetId_createdAt_idx" ON "collaboration_comments"("companyId", "budgetId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "budget_change_events_companyId_requestId_idx" ON "budget_change_events"("companyId", "requestId");
