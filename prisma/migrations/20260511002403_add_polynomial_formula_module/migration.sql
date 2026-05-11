-- CreateEnum
CREATE TYPE "PolynomialFormulaStatus" AS ENUM ('DRAFT', 'VALID', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PolynomialCostGroup" AS ENUM ('LABOR', 'MATERIALS', 'EQUIPMENT', 'OTHERS', 'GENERAL_EXPENSES_PROFIT', 'STEEL', 'CEMENT', 'MASONRY', 'INSTALLATIONS');

-- CreateTable
CREATE TABLE "PolynomialFormula" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseMonth" INTEGER NOT NULL,
    "baseYear" INTEGER NOT NULL,
    "totalBaseAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PolynomialFormulaStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolynomialFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolynomialMonomial" (
    "id" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "costGroupKey" "PolynomialCostGroup" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "coefficient" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "baseIndexCode" TEXT NOT NULL,
    "baseIndexName" TEXT NOT NULL,
    "baseIndexValue" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "adjustmentIndexCode" TEXT,
    "adjustmentIndexName" TEXT,
    "adjustmentIndexValue" DECIMAL(18,3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolynomialMonomial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolynomialMonomialComponent" (
    "id" TEXT NOT NULL,
    "monomialId" TEXT NOT NULL,
    "budgetItemId" TEXT,
    "apuResourceId" TEXT,
    "resourceType" TEXT,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolynomialMonomialComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnifiedIndex" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "geographicArea" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "value" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnifiedIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "formulaId" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Valuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentCalculation" (
    "id" TEXT NOT NULL,
    "formulaId" TEXT NOT NULL,
    "valuationId" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "originalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "adjustedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "adjustmentAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "kRaw" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "kRounded" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdjustmentCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentCalculationTerm" (
    "id" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "monomialId" TEXT,
    "name" TEXT NOT NULL,
    "coefficient" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "baseIndexValue" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "adjustmentIndexValue" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "ratio" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "partial" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdjustmentCalculationTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolynomialFormula_budgetId_idx" ON "PolynomialFormula"("budgetId");

-- CreateIndex
CREATE INDEX "PolynomialFormula_baseYear_baseMonth_idx" ON "PolynomialFormula"("baseYear", "baseMonth");

-- CreateIndex
CREATE INDEX "PolynomialMonomial_formulaId_idx" ON "PolynomialMonomial"("formulaId");

-- CreateIndex
CREATE INDEX "PolynomialMonomial_costGroupKey_idx" ON "PolynomialMonomial"("costGroupKey");

-- CreateIndex
CREATE UNIQUE INDEX "PolynomialMonomial_formulaId_sortOrder_key" ON "PolynomialMonomial"("formulaId", "sortOrder");

-- CreateIndex
CREATE INDEX "PolynomialMonomialComponent_monomialId_idx" ON "PolynomialMonomialComponent"("monomialId");

-- CreateIndex
CREATE INDEX "PolynomialMonomialComponent_budgetItemId_idx" ON "PolynomialMonomialComponent"("budgetItemId");

-- CreateIndex
CREATE INDEX "PolynomialMonomialComponent_apuResourceId_idx" ON "PolynomialMonomialComponent"("apuResourceId");

-- CreateIndex
CREATE INDEX "UnifiedIndex_year_month_idx" ON "UnifiedIndex"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "UnifiedIndex_code_month_year_key" ON "UnifiedIndex"("code", "month", "year");

-- CreateIndex
CREATE INDEX "Valuation_formulaId_idx" ON "Valuation"("formulaId");

-- CreateIndex
CREATE UNIQUE INDEX "Valuation_budgetId_year_month_key" ON "Valuation"("budgetId", "year", "month");

-- CreateIndex
CREATE INDEX "AdjustmentCalculation_valuationId_idx" ON "AdjustmentCalculation"("valuationId");

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentCalculation_formulaId_year_month_key" ON "AdjustmentCalculation"("formulaId", "year", "month");

-- CreateIndex
CREATE INDEX "AdjustmentCalculationTerm_adjustmentId_idx" ON "AdjustmentCalculationTerm"("adjustmentId");

-- CreateIndex
CREATE INDEX "AdjustmentCalculationTerm_monomialId_idx" ON "AdjustmentCalculationTerm"("monomialId");

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentCalculationTerm_adjustmentId_sortOrder_key" ON "AdjustmentCalculationTerm"("adjustmentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "PolynomialFormula" ADD CONSTRAINT "PolynomialFormula_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolynomialMonomial" ADD CONSTRAINT "PolynomialMonomial_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "PolynomialFormula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolynomialMonomialComponent" ADD CONSTRAINT "PolynomialMonomialComponent_monomialId_fkey" FOREIGN KEY ("monomialId") REFERENCES "PolynomialMonomial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolynomialMonomialComponent" ADD CONSTRAINT "PolynomialMonomialComponent_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolynomialMonomialComponent" ADD CONSTRAINT "PolynomialMonomialComponent_apuResourceId_fkey" FOREIGN KEY ("apuResourceId") REFERENCES "ApuResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "PolynomialFormula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentCalculation" ADD CONSTRAINT "AdjustmentCalculation_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "PolynomialFormula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentCalculation" ADD CONSTRAINT "AdjustmentCalculation_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentCalculationTerm" ADD CONSTRAINT "AdjustmentCalculationTerm_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "AdjustmentCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentCalculationTerm" ADD CONSTRAINT "AdjustmentCalculationTerm_monomialId_fkey" FOREIGN KEY ("monomialId") REFERENCES "PolynomialMonomial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
