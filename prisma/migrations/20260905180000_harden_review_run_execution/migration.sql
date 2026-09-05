ALTER TABLE "ReviewRun"
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN "stageDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "failureCode" TEXT;

CREATE INDEX "ReviewRun_companyId_status_nextRetryAt_idx"
  ON "ReviewRun"("companyId", "status", "nextRetryAt");
