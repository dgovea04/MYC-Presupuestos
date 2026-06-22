-- CreateTable
CREATE TABLE "ai_session_feedback_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "historyEntryId" TEXT NOT NULL,
    "feedbackType" "AiSuggestionFeedbackType" NOT NULL,
    "notes" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "task" TEXT,
    "suggestionType" TEXT,
    "actionType" TEXT,
    "promptHash" TEXT,
    "responseHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_session_feedback_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_session_feedback_event_userId_createdAt_idx" ON "ai_session_feedback_event"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_session_feedback_event_historyEntryId_createdAt_idx" ON "ai_session_feedback_event"("historyEntryId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_session_feedback_event_feedbackType_createdAt_idx" ON "ai_session_feedback_event"("feedbackType", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ai_session_feedback_event" ADD CONSTRAINT "ai_session_feedback_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
