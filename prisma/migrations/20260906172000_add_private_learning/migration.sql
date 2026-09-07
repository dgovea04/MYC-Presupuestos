CREATE TYPE "PrivateLearningExampleStatus" AS ENUM ('ACTIVE','REVOKED','EXPIRED');
CREATE TABLE "private_learning_examples" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "signalType" TEXT NOT NULL,
  "inputJson" JSONB NOT NULL, "resultJson" JSONB NOT NULL, "contentHash" TEXT NOT NULL, "schemaVersion" TEXT NOT NULL,
  "status" "PrivateLearningExampleStatus" NOT NULL DEFAULT 'ACTIVE', "expiresAt" TIMESTAMP(3) NOT NULL, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), CONSTRAINT "private_learning_examples_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "private_learning_examples_companyId_contentHash_schemaVersion_key" ON "private_learning_examples"("companyId", "contentHash", "schemaVersion");
CREATE INDEX "private_learning_examples_companyId_status_expiresAt_idx" ON "private_learning_examples"("companyId", "status", "expiresAt");
CREATE TABLE "private_learning_usages" ("id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "exampleId" TEXT NOT NULL, "budgetId" TEXT, "requestId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "private_learning_usages_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "private_learning_usages_exampleId_requestId_key" ON "private_learning_usages"("exampleId", "requestId");
CREATE INDEX "private_learning_usages_companyId_createdAt_idx" ON "private_learning_usages"("companyId", "createdAt");
ALTER TABLE "private_learning_examples" ADD CONSTRAINT "private_learning_examples_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "private_learning_examples" ADD CONSTRAINT "private_learning_examples_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "private_learning_usages" ADD CONSTRAINT "private_learning_usages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "private_learning_usages" ADD CONSTRAINT "private_learning_usages_exampleId_fkey" FOREIGN KEY ("exampleId") REFERENCES "private_learning_examples"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "private_learning_usages" ADD CONSTRAINT "private_learning_usages_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
