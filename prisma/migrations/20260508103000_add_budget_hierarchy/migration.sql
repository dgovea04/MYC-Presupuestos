-- CreateEnum
CREATE TYPE "BudgetKind" AS ENUM ('GENERAL', 'SUB_BUDGET');

-- AlterTable
ALTER TABLE "Budget"
ADD COLUMN "parentBudgetId" TEXT,
ADD COLUMN "kind" "BudgetKind" NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX "Budget_parentBudgetId_idx" ON "Budget"("parentBudgetId");

-- AddForeignKey
ALTER TABLE "Budget"
ADD CONSTRAINT "Budget_parentBudgetId_fkey"
FOREIGN KEY ("parentBudgetId") REFERENCES "Budget"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
