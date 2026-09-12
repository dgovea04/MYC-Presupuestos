CREATE TABLE "knowledge_metric_events" (
  "id" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "companyId" TEXT,
  "projectId" TEXT,
  "findingId" TEXT,
  "decisionId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "durationMs" INTEGER,
  "retryCount" INTEGER,
  "errorCode" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_metric_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_metric_events_idempotencyKey_key" ON "knowledge_metric_events"("idempotencyKey");
CREATE INDEX "knowledge_metric_events_metric_createdAt_idx" ON "knowledge_metric_events"("metric", "createdAt" DESC);
CREATE INDEX "knowledge_metric_events_companyId_projectId_createdAt_idx" ON "knowledge_metric_events"("companyId", "projectId", "createdAt" DESC);
CREATE INDEX "knowledge_metric_events_stage_outcome_createdAt_idx" ON "knowledge_metric_events"("stage", "outcome", "createdAt" DESC);
