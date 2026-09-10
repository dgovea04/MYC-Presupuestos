CREATE TABLE "knowledge_integration_jobs" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "knowledge_integration_jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "knowledge_integration_jobs_idempotencyKey_key" ON "knowledge_integration_jobs"("idempotencyKey");
CREATE INDEX "knowledge_integration_jobs_companyId_projectId_status_nextRetryAt_idx" ON "knowledge_integration_jobs"("companyId", "projectId", "status", "nextRetryAt");
CREATE INDEX "knowledge_integration_jobs_findingId_decisionId_idx" ON "knowledge_integration_jobs"("findingId", "decisionId");
