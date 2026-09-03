-- DropIndex
DROP INDEX "BudgetItem_discipline_idx";

-- DropIndex
DROP INDEX "FindingDecision_correctionVersionId_idx";

-- DropIndex
DROP INDEX "ReviewFinding_baseSnapshotId_idx";

-- DropIndex
DROP INDEX "ReviewFinding_discipline_idx";

-- RenameForeignKey
ALTER TABLE "ReviewRunDocumentVersion" RENAME CONSTRAINT "ReviewRunDocumentVersion_documentVersionId_companyId_projectId_" TO "ReviewRunDocumentVersion_documentVersionId_companyId_proje_fkey";
