-- AlterTable
ALTER TABLE "AiSuggestionFeedbackEvent"
ADD COLUMN "provider" TEXT,
ADD COLUMN "model" TEXT,
ADD COLUMN "task" TEXT,
ADD COLUMN "suggestionType" TEXT,
ADD COLUMN "actionType" TEXT,
ADD COLUMN "promptHash" TEXT,
ADD COLUMN "responseHash" TEXT;

-- CreateIndex
CREATE INDEX "AiSuggestionFeedbackEvent_provider_createdAt_idx" ON "AiSuggestionFeedbackEvent"("provider", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AiSuggestionFeedbackEvent_task_createdAt_idx" ON "AiSuggestionFeedbackEvent"("task", "createdAt" DESC);
