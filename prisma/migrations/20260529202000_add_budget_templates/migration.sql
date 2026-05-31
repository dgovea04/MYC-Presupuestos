-- CreateTable
CREATE TABLE "budget_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceProjectId" TEXT,
    "sourceBudgetId" TEXT,
    "module" TEXT NOT NULL DEFAULT 'BUDGET',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_templates_userId_updatedAt_idx" ON "budget_templates"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "budget_templates_sourceProjectId_idx" ON "budget_templates"("sourceProjectId");

-- CreateIndex
CREATE INDEX "budget_templates_sourceBudgetId_idx" ON "budget_templates"("sourceBudgetId");

-- AddForeignKey
ALTER TABLE "budget_templates" ADD CONSTRAINT "budget_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_templates" ADD CONSTRAINT "budget_templates_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_templates" ADD CONSTRAINT "budget_templates_sourceBudgetId_fkey" FOREIGN KEY ("sourceBudgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
