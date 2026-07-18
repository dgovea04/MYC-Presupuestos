-- CreateEnum
CREATE TYPE "RiskScenarioSource" AS ENUM ('MANUAL', 'AGENT');

-- CreateEnum
CREATE TYPE "RiskScenarioStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RiskInputSource" AS ENUM ('MANUAL', 'AGENT', 'HEURISTIC');

-- CreateTable
CREATE TABLE "RiskScenario" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" "RiskScenarioSource" NOT NULL DEFAULT 'MANUAL',
    "status" "RiskScenarioStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskScenario_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "RiskVariable"
ADD COLUMN "scenarioId" TEXT,
ADD COLUMN "source" "RiskInputSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "confidence" DECIMAL(5,4),
ADD COLUMN "rationale" TEXT;

-- AlterTable
ALTER TABLE "RiskCorrelation"
ADD COLUMN "scenarioId" TEXT,
ADD COLUMN "source" "RiskInputSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "confidence" DECIMAL(5,4),
ADD COLUMN "rationale" TEXT;

-- AlterTable
ALTER TABLE "RiskSimulationRun"
ADD COLUMN "scenarioId" TEXT,
ADD COLUMN "seed" TEXT,
ADD COLUMN "engineVersion" TEXT,
ADD COLUMN "modelSnapshot" JSONB;

-- DropIndex
DROP INDEX IF EXISTS "RiskVariable_budgetId_budgetItemId_variableType_key";

-- CreateIndex
CREATE INDEX "RiskScenario_budgetId_updatedAt_idx" ON "RiskScenario"("budgetId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "RiskVariable_budgetId_budgetItemId_variableType_idx" ON "RiskVariable"("budgetId", "budgetItemId", "variableType");

-- CreateIndex
CREATE INDEX "RiskVariable_budgetId_scenarioId_budgetItemId_variableType_idx" ON "RiskVariable"("budgetId", "scenarioId", "budgetItemId", "variableType");

-- CreateIndex
CREATE INDEX "RiskVariable_scenarioId_idx" ON "RiskVariable"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskVariable_budget_global_unique"
ON "RiskVariable" ("budgetId", "budgetItemId", "variableType")
WHERE "scenarioId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RiskVariable_budget_scenario_unique"
ON "RiskVariable" ("budgetId", "scenarioId", "budgetItemId", "variableType")
WHERE "scenarioId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "RiskCorrelation_scenarioId_idx" ON "RiskCorrelation"("scenarioId");

-- CreateIndex
CREATE INDEX "RiskCorrelation_budgetId_scenarioId_idx" ON "RiskCorrelation"("budgetId", "scenarioId");

-- CreateIndex
CREATE INDEX "RiskSimulationRun_scenarioId_createdAt_idx" ON "RiskSimulationRun"("scenarioId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "RiskScenario" ADD CONSTRAINT "RiskScenario_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScenario" ADD CONSTRAINT "RiskScenario_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskVariable" ADD CONSTRAINT "RiskVariable_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "RiskScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskCorrelation" ADD CONSTRAINT "RiskCorrelation_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "RiskScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSimulationRun" ADD CONSTRAINT "RiskSimulationRun_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "RiskScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
