ALTER TABLE "metrado_sheets"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "metrado_sheets_userId_isActive_updatedAt_idx"
ON "metrado_sheets"("userId", "isActive", "updatedAt" DESC);

CREATE INDEX "metrado_sheets_budgetId_isActive_idx"
ON "metrado_sheets"("budgetId", "isActive");
