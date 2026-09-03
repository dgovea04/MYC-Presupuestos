ALTER TABLE "budget_items" ADD COLUMN "discipline" TEXT;
ALTER TABLE "review_findings" ADD COLUMN "discipline" TEXT;
ALTER TABLE "finding_decisions" ADD COLUMN "previousStatus" "FindingStatus";
ALTER TABLE "finding_decisions" ADD COLUMN "newStatus" "FindingStatus";
ALTER TABLE "finding_decisions" ADD COLUMN "correctionVersionId" TEXT;
CREATE INDEX "budget_items_discipline_idx" ON "budget_items"("discipline");
CREATE INDEX "review_findings_discipline_idx" ON "review_findings"("companyId", "projectId", "discipline");
