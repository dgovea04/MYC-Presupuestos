ALTER TABLE "ReviewFinding" ADD COLUMN "assignedToId" TEXT;
ALTER TABLE "ReviewFinding" ADD COLUMN "assignedAt" TIMESTAMP(3);

CREATE INDEX "ReviewFinding_companyId_projectId_assignedToId_idx"
ON "ReviewFinding"("companyId", "projectId", "assignedToId");

ALTER TABLE "ReviewFinding"
ADD CONSTRAINT "ReviewFinding_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
