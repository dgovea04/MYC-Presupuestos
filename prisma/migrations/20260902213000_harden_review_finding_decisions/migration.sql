ALTER TABLE "BudgetItem" ADD COLUMN "discipline" TEXT;
ALTER TABLE "ReviewFinding" ADD COLUMN "discipline" TEXT;
ALTER TABLE "FindingDecision" ADD COLUMN "previousStatus" "FindingStatus";
ALTER TABLE "FindingDecision" ADD COLUMN "newStatus" "FindingStatus";
ALTER TABLE "FindingDecision" ADD COLUMN "correctionVersionId" TEXT;
CREATE INDEX "BudgetItem_discipline_idx" ON "BudgetItem"("discipline");
CREATE INDEX "ReviewFinding_discipline_idx" ON "ReviewFinding"("companyId", "projectId", "discipline");
