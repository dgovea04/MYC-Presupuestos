CREATE TABLE "RiskCorrelation" (
  "id" TEXT NOT NULL,
  "budgetId" TEXT NOT NULL,
  "sourceVariableId" TEXT NOT NULL,
  "targetVariableId" TEXT NOT NULL,
  "coefficient" DECIMAL(8,4) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RiskCorrelation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RiskCorrelation_budgetId_sourceVariableId_targetVariableId_key"
ON "RiskCorrelation"("budgetId", "sourceVariableId", "targetVariableId");

CREATE INDEX "RiskCorrelation_budgetId_idx" ON "RiskCorrelation"("budgetId");
CREATE INDEX "RiskCorrelation_sourceVariableId_idx" ON "RiskCorrelation"("sourceVariableId");
CREATE INDEX "RiskCorrelation_targetVariableId_idx" ON "RiskCorrelation"("targetVariableId");

ALTER TABLE "RiskCorrelation"
ADD CONSTRAINT "RiskCorrelation_budgetId_fkey"
FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskCorrelation"
ADD CONSTRAINT "RiskCorrelation_sourceVariableId_fkey"
FOREIGN KEY ("sourceVariableId") REFERENCES "RiskVariable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskCorrelation"
ADD CONSTRAINT "RiskCorrelation_targetVariableId_fkey"
FOREIGN KEY ("targetVariableId") REFERENCES "RiskVariable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
