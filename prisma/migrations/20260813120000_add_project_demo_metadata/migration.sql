ALTER TABLE "Project" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "demoKey" TEXT;

CREATE INDEX "Project_companyId_isDemo_idx" ON "Project"("companyId", "isDemo");
CREATE INDEX "Project_companyId_demoKey_idx" ON "Project"("companyId", "demoKey");
