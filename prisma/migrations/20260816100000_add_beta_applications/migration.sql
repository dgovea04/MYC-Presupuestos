CREATE TYPE "BetaApplicationStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "beta_applications" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "campaign" TEXT NOT NULL DEFAULT 'founding-users-peru',
  "status" "BetaApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "beta_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "beta_applications_status_createdAt_idx" ON "beta_applications"("status", "createdAt" DESC);
CREATE INDEX "beta_applications_email_createdAt_idx" ON "beta_applications"("email", "createdAt" DESC);
CREATE UNIQUE INDEX "beta_applications_active_email_campaign_key"
  ON "beta_applications"("email", "campaign")
  WHERE "status" IN ('PENDING', 'APPROVED');

ALTER TABLE "beta_applications"
ADD CONSTRAINT "beta_applications_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
