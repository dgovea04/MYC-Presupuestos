-- CreateEnum
CREATE TYPE "RiskVariableType" AS ENUM ('QUANTITY');

-- CreateEnum
CREATE TYPE "RiskDistributionType" AS ENUM ('TRIANGULAR');

-- CreateTable
CREATE TABLE "RiskVariable" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "variableType" "RiskVariableType" NOT NULL DEFAULT 'QUANTITY',
    "distributionType" "RiskDistributionType" NOT NULL DEFAULT 'TRIANGULAR',
    "minimum" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "mostLikely" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "maximum" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSimulationRun" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "iterations" INTEGER NOT NULL,
    "baseTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "mean" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "median" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "variance" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "standardDeviation" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "skewness" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "kurtosis" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "p10" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "p50" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "p80" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "p90" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "p95" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "histogramBins" JSONB NOT NULL,
    "sCurvePoints" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskSimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskVariable_budgetId_budgetItemId_variableType_key" ON "RiskVariable"("budgetId", "budgetItemId", "variableType");

-- CreateIndex
CREATE INDEX "RiskVariable_budgetId_idx" ON "RiskVariable"("budgetId");

-- CreateIndex
CREATE INDEX "RiskVariable_budgetItemId_idx" ON "RiskVariable"("budgetItemId");

-- CreateIndex
CREATE INDEX "RiskSimulationRun_budgetId_createdAt_idx" ON "RiskSimulationRun"("budgetId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "RiskVariable" ADD CONSTRAINT "RiskVariable_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskVariable" ADD CONSTRAINT "RiskVariable_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSimulationRun" ADD CONSTRAINT "RiskSimulationRun_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
