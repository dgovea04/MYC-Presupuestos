ALTER TABLE "FindingDecision"
  ADD CONSTRAINT "FindingDecision_correctionVersionId_fkey"
  FOREIGN KEY ("correctionVersionId") REFERENCES "budget_version_snapshots"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "FindingDecision_correctionVersionId_idx" ON "FindingDecision"("correctionVersionId");
