CREATE TYPE "AiSuggestionFeedbackType" AS ENUM ('APPLIED', 'EDITED', 'DISMISSED');

CREATE TABLE "AiSuggestionFeedbackEvent" (
  "id" TEXT NOT NULL,
  "historyEntryId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "feedbackType" "AiSuggestionFeedbackType" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiSuggestionFeedbackEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiSuggestionFeedbackEvent_historyEntryId_createdAt_idx"
  ON "AiSuggestionFeedbackEvent"("historyEntryId", "createdAt" DESC);

CREATE INDEX "AiSuggestionFeedbackEvent_projectId_createdAt_idx"
  ON "AiSuggestionFeedbackEvent"("projectId", "createdAt" DESC);

CREATE INDEX "AiSuggestionFeedbackEvent_userId_createdAt_idx"
  ON "AiSuggestionFeedbackEvent"("userId", "createdAt" DESC);

CREATE INDEX "AiSuggestionFeedbackEvent_feedbackType_createdAt_idx"
  ON "AiSuggestionFeedbackEvent"("feedbackType", "createdAt" DESC);

ALTER TABLE "AiSuggestionFeedbackEvent"
  ADD CONSTRAINT "AiSuggestionFeedbackEvent_historyEntryId_fkey"
  FOREIGN KEY ("historyEntryId") REFERENCES "AiProjectHistoryEntry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiSuggestionFeedbackEvent"
  ADD CONSTRAINT "AiSuggestionFeedbackEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiSuggestionFeedbackEvent"
  ADD CONSTRAINT "AiSuggestionFeedbackEvent_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
