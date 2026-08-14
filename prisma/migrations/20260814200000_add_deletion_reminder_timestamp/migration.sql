ALTER TABLE "admin_deletion_approvals"
  ADD COLUMN "deletionReminderSentAt" TIMESTAMP(3);

CREATE INDEX "admin_deletion_approvals_reminder_idx"
  ON "admin_deletion_approvals"("status", "deletionReminderSentAt");
