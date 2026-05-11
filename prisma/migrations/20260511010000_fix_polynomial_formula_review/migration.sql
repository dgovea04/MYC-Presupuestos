-- DropForeignKey
ALTER TABLE "AdjustmentCalculation" DROP CONSTRAINT "AdjustmentCalculation_valuationId_fkey";

-- DropForeignKey
ALTER TABLE "AdjustmentCalculationTerm" DROP CONSTRAINT "AdjustmentCalculationTerm_monomialId_fkey";

-- DropForeignKey
ALTER TABLE "PolynomialFormula" DROP CONSTRAINT "PolynomialFormula_budgetId_fkey";

-- DropForeignKey
ALTER TABLE "Valuation" DROP CONSTRAINT "Valuation_formulaId_fkey";

-- DropIndex
DROP INDEX "UnifiedIndex_code_month_year_key";

-- AlterTable
ALTER TABLE "PolynomialFormula" ADD COLUMN "projectId" TEXT;

UPDATE "PolynomialFormula" AS "pf"
SET "projectId" = "b"."projectId"
FROM "Budget" AS "b"
WHERE "pf"."budgetId" = "b"."id";

ALTER TABLE "PolynomialFormula" ALTER COLUMN "projectId" SET NOT NULL;

ALTER TABLE "AdjustmentCalculation" ALTER COLUMN "valuationId" SET NOT NULL;

ALTER TABLE "AdjustmentCalculationTerm" ALTER COLUMN "monomialId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentCalculation_valuationId_key" ON "AdjustmentCalculation"("valuationId");

CREATE UNIQUE INDEX "Budget_id_projectId_key" ON "Budget"("id", "projectId");

CREATE INDEX "PolynomialFormula_projectId_idx" ON "PolynomialFormula"("projectId");

CREATE UNIQUE INDEX "PolynomialFormula_id_budgetId_key" ON "PolynomialFormula"("id", "budgetId");

CREATE UNIQUE INDEX "UnifiedIndex_code_geographicArea_month_year_key" ON "UnifiedIndex"("code", "geographicArea", "month", "year");

CREATE UNIQUE INDEX "Valuation_id_formulaId_year_month_key" ON "Valuation"("id", "formulaId", "year", "month");

-- AddForeignKey
ALTER TABLE "PolynomialFormula" ADD CONSTRAINT "PolynomialFormula_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PolynomialFormula" ADD CONSTRAINT "PolynomialFormula_budgetId_projectId_fkey" FOREIGN KEY ("budgetId", "projectId") REFERENCES "Budget"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_formulaId_budgetId_fkey" FOREIGN KEY ("formulaId", "budgetId") REFERENCES "PolynomialFormula"("id", "budgetId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdjustmentCalculation" ADD CONSTRAINT "AdjustmentCalculation_valuationId_formulaId_year_month_fkey" FOREIGN KEY ("valuationId", "formulaId", "year", "month") REFERENCES "Valuation"("id", "formulaId", "year", "month") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdjustmentCalculationTerm" ADD CONSTRAINT "AdjustmentCalculationTerm_monomialId_fkey" FOREIGN KEY ("monomialId") REFERENCES "PolynomialMonomial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraints
ALTER TABLE "PolynomialFormula"
ADD CONSTRAINT "PolynomialFormula_baseMonth_check"
CHECK ("baseMonth" BETWEEN 1 AND 12);

ALTER TABLE "UnifiedIndex"
ADD CONSTRAINT "UnifiedIndex_month_check"
CHECK ("month" BETWEEN 1 AND 12);

ALTER TABLE "Valuation"
ADD CONSTRAINT "Valuation_month_check"
CHECK ("month" BETWEEN 1 AND 12);

ALTER TABLE "AdjustmentCalculation"
ADD CONSTRAINT "AdjustmentCalculation_month_check"
CHECK ("month" BETWEEN 1 AND 12);

ALTER TABLE "PolynomialMonomialComponent"
ADD CONSTRAINT "PolynomialMonomialComponent_source_check"
CHECK (
  (CASE WHEN "budgetItemId" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "apuResourceId" IS NOT NULL THEN 1 ELSE 0 END) = 1
);
