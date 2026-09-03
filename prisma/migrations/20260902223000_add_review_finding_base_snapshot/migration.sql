ALTER TABLE "ReviewFinding" ADD COLUMN "baseSnapshotId" TEXT;

ALTER TABLE "ReviewFinding"
  ADD CONSTRAINT "ReviewFinding_baseSnapshotId_fkey"
  FOREIGN KEY ("baseSnapshotId") REFERENCES "budget_version_snapshots"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ReviewFinding_baseSnapshotId_idx" ON "ReviewFinding"("baseSnapshotId");
