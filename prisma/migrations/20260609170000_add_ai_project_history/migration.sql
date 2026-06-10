CREATE TABLE "AiProjectHistoryEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "answer" TEXT NOT NULL,
    "structuredData" JSONB,
    "model" TEXT NOT NULL,
    "requestedModel" TEXT NOT NULL,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "warnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiProjectHistoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiProjectHistoryEntry_projectId_createdAt_idx" ON "AiProjectHistoryEntry"("projectId", "createdAt" DESC);
CREATE INDEX "AiProjectHistoryEntry_userId_createdAt_idx" ON "AiProjectHistoryEntry"("userId", "createdAt" DESC);
CREATE INDEX "AiProjectHistoryEntry_action_createdAt_idx" ON "AiProjectHistoryEntry"("action", "createdAt" DESC);

ALTER TABLE "AiProjectHistoryEntry" ADD CONSTRAINT "AiProjectHistoryEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiProjectHistoryEntry" ADD CONSTRAINT "AiProjectHistoryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
