ALTER TABLE "knowledge_integration_jobs"
  ADD COLUMN "actorUserId" TEXT,
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "knowledge_integration_jobs_status_nextRetryAt_idx"
  ON "knowledge_integration_jobs"("status", "nextRetryAt");
