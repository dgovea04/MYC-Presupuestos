CREATE TYPE "BetaCampaignStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'FINISHED'
);

CREATE TYPE "BetaAssignmentMode" AS ENUM (
  'AUTOMATIC',
  'ADMIN',
  'CODE',
  'MIXED'
);

CREATE TYPE "BetaGrantStatus" AS ENUM (
  'SCHEDULED',
  'ACTIVE',
  'EXPIRED',
  'REVOKED'
);

CREATE TYPE "BetaGrantSource" AS ENUM (
  'AUTOMATIC',
  'ADMIN',
  'CODE',
  'IMPORT'
);

CREATE TABLE "beta_campaigns" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "planSlug" TEXT NOT NULL DEFAULT 'pro',
  "durationDays" INTEGER NOT NULL,
  "status" "BetaCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "assignmentMode" "BetaAssignmentMode" NOT NULL DEFAULT 'ADMIN',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "maxAssignments" INTEGER,
  "eligibilityRules" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "beta_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "beta_grants" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT,
  "planSlug" TEXT NOT NULL DEFAULT 'pro',
  "status" "BetaGrantStatus" NOT NULL DEFAULT 'SCHEDULED',
  "source" "BetaGrantSource" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "assignedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "beta_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "beta_campaigns_code_key" ON "beta_campaigns"("code");
CREATE INDEX "beta_campaigns_status_startsAt_idx" ON "beta_campaigns"("status", "startsAt");
CREATE INDEX "beta_campaigns_assignmentMode_status_idx" ON "beta_campaigns"("assignmentMode", "status");

CREATE UNIQUE INDEX "beta_grants_campaignId_userId_key" ON "beta_grants"("campaignId", "userId");
CREATE INDEX "beta_grants_userId_status_expiresAt_idx" ON "beta_grants"("userId", "status", "expiresAt");
CREATE INDEX "beta_grants_campaignId_status_idx" ON "beta_grants"("campaignId", "status");
CREATE INDEX "beta_grants_expiresAt_status_idx" ON "beta_grants"("expiresAt", "status");
CREATE INDEX "beta_grants_companyId_status_idx" ON "beta_grants"("companyId", "status");

ALTER TABLE "beta_campaigns"
ADD CONSTRAINT "beta_campaigns_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "beta_grants"
ADD CONSTRAINT "beta_grants_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "beta_campaigns"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "beta_grants"
ADD CONSTRAINT "beta_grants_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "beta_grants"
ADD CONSTRAINT "beta_grants_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "beta_grants"
ADD CONSTRAINT "beta_grants_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "beta_grants"
ADD CONSTRAINT "beta_grants_revokedById_fkey"
FOREIGN KEY ("revokedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
