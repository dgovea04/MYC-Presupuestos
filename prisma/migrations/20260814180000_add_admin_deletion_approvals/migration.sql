CREATE TABLE "admin_deletion_approvals" (
  "id" TEXT NOT NULL,
  "targetUserId" TEXT,
  "targetEmail" TEXT NOT NULL,
  "requestedById" TEXT,
  "approvedById" TEXT,
  "confirmationEmail" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),

  CONSTRAINT "admin_deletion_approvals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_deletion_approvals_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "admin_deletion_approvals_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "admin_deletion_approvals_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "admin_deletion_approvals_status_expiresAt_idx"
  ON "admin_deletion_approvals"("status", "expiresAt");
CREATE INDEX "admin_deletion_approvals_targetUserId_idx"
  ON "admin_deletion_approvals"("targetUserId");
CREATE INDEX "admin_deletion_approvals_requestedById_idx"
  ON "admin_deletion_approvals"("requestedById");
CREATE UNIQUE INDEX "admin_deletion_approvals_pending_target_key"
  ON "admin_deletion_approvals"("targetUserId")
  WHERE "status" = 'PENDING' AND "targetUserId" IS NOT NULL;
