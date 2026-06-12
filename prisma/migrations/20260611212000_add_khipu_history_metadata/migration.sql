ALTER TABLE "AiProjectHistoryEntry"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "task" TEXT,
  ADD COLUMN "promptHash" TEXT,
  ADD COLUMN "responseHash" TEXT;

CREATE INDEX "AiProjectHistoryEntry_provider_createdAt_idx"
  ON "AiProjectHistoryEntry"("provider", "createdAt" DESC);

CREATE INDEX "AiProjectHistoryEntry_task_createdAt_idx"
  ON "AiProjectHistoryEntry"("task", "createdAt" DESC);
