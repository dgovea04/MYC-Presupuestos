-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AiTokenLedgerType" AS ENUM ('RESERVE', 'CONSUME', 'RELEASE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "MembershipPlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "monthlyTokenLimit" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "membershipPlanId" TEXT,
ADD COLUMN "aiTokenExtraMonthly" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AiUsagePeriod" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "consumedTokens" INTEGER NOT NULL DEFAULT 0,
  "reservedTokens" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiUsagePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTokenLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "adminUserId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "type" "AiTokenLedgerType" NOT NULL,
  "tokens" INTEGER NOT NULL,
  "estimatedTokens" INTEGER,
  "actualTokens" INTEGER,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiTokenLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPlan_slug_key" ON "MembershipPlan"("slug");

-- SeedData
INSERT INTO "MembershipPlan" ("id", "name", "slug", "monthlyTokenLimit", "updatedAt")
VALUES
  ('plan_starter', 'Starter', 'starter', 100000, CURRENT_TIMESTAMP),
  ('plan_pro', 'Pro', 'pro', 500000, CURRENT_TIMESTAMP),
  ('plan_empresa', 'Empresa', 'empresa', 2000000, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "User"
SET "membershipPlanId" = 'plan_starter'
WHERE "membershipPlanId" IS NULL;

-- CreateIndex
CREATE INDEX "MembershipPlan_isActive_idx" ON "MembershipPlan"("isActive");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_membershipPlanId_idx" ON "User"("membershipPlanId");
CREATE UNIQUE INDEX "AiUsagePeriod_userId_periodStart_key" ON "AiUsagePeriod"("userId", "periodStart");
CREATE INDEX "AiUsagePeriod_periodStart_idx" ON "AiUsagePeriod"("periodStart");
CREATE INDEX "AiTokenLedger_userId_periodStart_idx" ON "AiTokenLedger"("userId", "periodStart");
CREATE INDEX "AiTokenLedger_adminUserId_idx" ON "AiTokenLedger"("adminUserId");
CREATE INDEX "AiTokenLedger_action_createdAt_idx" ON "AiTokenLedger"("action", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_membershipPlanId_fkey" FOREIGN KEY ("membershipPlanId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiUsagePeriod" ADD CONSTRAINT "AiUsagePeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiTokenLedger" ADD CONSTRAINT "AiTokenLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiTokenLedger" ADD CONSTRAINT "AiTokenLedger_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
