ALTER TABLE "User"
  ADD COLUMN "deletionScheduledAt" TIMESTAMP(3),
  ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "User_deletionScheduledAt_idx"
  ON "User"("deletionScheduledAt");
