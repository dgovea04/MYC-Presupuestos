DROP INDEX "Project_companyId_demoKey_idx";

CREATE UNIQUE INDEX "Project_companyId_demoKey_key" ON "Project"("companyId", "demoKey");
