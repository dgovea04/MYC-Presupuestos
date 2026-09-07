DO $$ BEGIN
  CREATE TYPE "IntegrationSessionStatus" AS ENUM ('DRAFT','STAGED','VALIDATED','PREVIEW_READY','CONFIRMED','APPLIED','ROLLED_BACK','FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE "integration_sessions" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "budgetId" TEXT NOT NULL, "createdById" TEXT NOT NULL,
  "adapter" TEXT NOT NULL, "contractVersion" TEXT NOT NULL, "status" "IntegrationSessionStatus" NOT NULL DEFAULT 'DRAFT', "payloadHash" TEXT NOT NULL,
  "stagedPayload" JSONB, "confirmationToken" TEXT, "expectedVersion" INTEGER, "counts" JSONB, "preview" JSONB, "result" JSONB, "requestId" TEXT NOT NULL,
  "snapshotId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "appliedAt" TIMESTAMP(3), "rolledBackAt" TIMESTAMP(3), CONSTRAINT "integration_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "integration_sessions_companyId_requestId_key" ON "integration_sessions"("companyId", "requestId");
CREATE INDEX "integration_sessions_budgetId_status_updatedAt_idx" ON "integration_sessions"("budgetId", "status", "updatedAt");
CREATE TABLE "integration_conflicts" ("id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "externalKey" TEXT NOT NULL, "kind" TEXT NOT NULL, "message" TEXT NOT NULL, "details" JSONB, "resolved" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "integration_conflicts_pkey" PRIMARY KEY ("id"));
CREATE INDEX "integration_conflicts_sessionId_resolved_idx" ON "integration_conflicts"("sessionId", "resolved");
CREATE TABLE "integration_mappings" ("id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "externalKey" TEXT NOT NULL, "internalId" TEXT, "mappingType" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "integration_mappings_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "integration_mappings_sessionId_externalKey_key" ON "integration_mappings"("sessionId", "externalKey");
ALTER TABLE "integration_sessions" ADD CONSTRAINT "integration_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_sessions" ADD CONSTRAINT "integration_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_sessions" ADD CONSTRAINT "integration_sessions_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_sessions" ADD CONSTRAINT "integration_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_conflicts" ADD CONSTRAINT "integration_conflicts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "integration_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_mappings" ADD CONSTRAINT "integration_mappings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "integration_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
