ALTER TABLE "knowledge_integration_jobs"
  ADD COLUMN "jobType" TEXT NOT NULL DEFAULT 'REVIEW_LEARNING',
  ADD COLUMN "payload" JSONB;

ALTER TABLE "knowledge_integration_jobs"
  ALTER COLUMN "findingId" DROP NOT NULL,
  ALTER COLUMN "decisionId" DROP NOT NULL;

CREATE INDEX "knowledge_integration_jobs_jobType_status_nextRetryAt_idx"
  ON "knowledge_integration_jobs"("jobType", "status", "nextRetryAt");
