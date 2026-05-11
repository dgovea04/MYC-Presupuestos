CREATE TABLE "BudgetFooterRow" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "variable" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "formula" TEXT,
    "manualValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "iu" TEXT,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetFooterRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BudgetFooterRow_budgetId_idx" ON "BudgetFooterRow"("budgetId");

ALTER TABLE "BudgetFooterRow" ADD CONSTRAINT "BudgetFooterRow_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
