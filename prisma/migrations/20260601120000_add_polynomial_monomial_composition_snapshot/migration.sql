ALTER TABLE "PolynomialMonomialComponent"
ADD COLUMN "unifiedIndexCode" TEXT,
ADD COLUMN "unifiedIndexName" TEXT,
ADD COLUMN "iuFamily" TEXT,
ADD COLUMN "participationPercentage" DECIMAL(12, 6),
ADD COLUMN "coefficientContribution" DECIMAL(12, 6);

CREATE INDEX "PolynomialMonomialComponent_unifiedIndexCode_idx"
ON "PolynomialMonomialComponent"("unifiedIndexCode");
