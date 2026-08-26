CREATE TYPE "AiCredentialScope" AS ENUM ('PLATFORM', 'WORKSPACE', 'USER');
CREATE TYPE "AiCredentialStatus" AS ENUM ('ACTIVE', 'INVALID', 'REVOKED');
CREATE TYPE "AiPolicyMode" AS ENUM ('PLATFORM', 'WORKSPACE', 'BYOK_ALLOWED', 'BYOK_ONLY');
CREATE TYPE "AiCredentialProvider" AS ENUM ('OPENAI', 'GEMINI', 'OPENROUTER');
CREATE TYPE "AiCredentialAuditOperation" AS ENUM ('CREATED', 'ROTATED', 'TESTED', 'REVOKED', 'POLICY_UPDATED');

ALTER TABLE "MembershipPlan"
  ADD COLUMN "allowKhipuChat" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowKhipuAgent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowByok" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowWorkspaceKey" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowedAiProviders" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "allowedAiModels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "userAiTokenLimit" INTEGER,
  ADD COLUMN "workspaceAiTokenLimit" INTEGER,
  ADD COLUMN "monthlyBudgetMinor" INTEGER,
  ADD COLUMN "allowAgentWrites" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AiUsagePeriod"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "reservedCostMinor" INTEGER,
  ADD COLUMN "estimatedCostMinor" INTEGER,
  ADD COLUMN "actualCostMinor" INTEGER;

ALTER TABLE "AiTokenLedger"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "reservedCostMinor" INTEGER,
  ADD COLUMN "inputTokens" INTEGER,
  ADD COLUMN "outputTokens" INTEGER,
  ADD COLUMN "estimatedCostMinor" INTEGER,
  ADD COLUMN "actualCostMinor" INTEGER,
  ADD COLUMN "credentialSource" TEXT,
  ADD COLUMN "credentialId" TEXT,
  ADD COLUMN "billingScope" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "fallbackUsed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ai_credentials" (
  "id" TEXT NOT NULL,
  "scope" "AiCredentialScope" NOT NULL,
  "workspaceId" TEXT,
  "userId" TEXT,
  "provider" "AiCredentialProvider" NOT NULL,
  "secretReference" TEXT,
  "encryptedSecret" TEXT,
  "maskedValue" TEXT NOT NULL,
  "status" "AiCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "isFallback" BOOLEAN NOT NULL DEFAULT false,
  "lastValidatedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdByUserId" TEXT,
  "rotatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_policies" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "mode" "AiPolicyMode" NOT NULL DEFAULT 'PLATFORM',
  "defaultProvider" "AiCredentialProvider" NOT NULL DEFAULT 'OPENAI',
  "allowedProviders" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowedModels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowUserKeys" BOOLEAN NOT NULL DEFAULT false,
  "allowWorkspaceKey" BOOLEAN NOT NULL DEFAULT false,
  "fallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
  "monthlyTokenLimit" INTEGER,
  "monthlyBudgetMinor" INTEGER,
  "hardLimit" BOOLEAN NOT NULL DEFAULT true,
  "alertThresholds" INTEGER[] NOT NULL DEFAULT ARRAY[80, 90, 100],
  "allowAgentWrites" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_credential_audit_events" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "credentialId" TEXT,
  "actorUserId" TEXT,
  "operation" "AiCredentialAuditOperation" NOT NULL,
  "provider" "AiCredentialProvider",
  "success" BOOLEAN NOT NULL DEFAULT true,
  "errorCode" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_credential_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_workspace_usage_periods" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "consumedTokens" INTEGER NOT NULL DEFAULT 0,
  "reservedTokens" INTEGER NOT NULL DEFAULT 0,
  "reservedCostMinor" INTEGER,
  "estimatedCostMinor" INTEGER,
  "actualCostMinor" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_workspace_usage_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_user_workspace_usage_periods" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "consumedTokens" INTEGER NOT NULL DEFAULT 0,
  "reservedTokens" INTEGER NOT NULL DEFAULT 0,
  "reservedCostMinor" INTEGER,
  "estimatedCostMinor" INTEGER,
  "actualCostMinor" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_user_workspace_usage_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_policies_workspaceId_key" ON "ai_policies"("workspaceId");
CREATE UNIQUE INDEX "ai_user_workspace_usage_periods_userId_workspaceId_periodStart_key" ON "ai_user_workspace_usage_periods"("userId", "workspaceId", "periodStart");
CREATE INDEX "ai_user_workspace_usage_periods_workspaceId_periodStart_idx" ON "ai_user_workspace_usage_periods"("workspaceId", "periodStart");
CREATE INDEX "ai_user_workspace_usage_periods_periodStart_idx" ON "ai_user_workspace_usage_periods"("periodStart");
CREATE UNIQUE INDEX "ai_workspace_usage_periods_workspaceId_periodStart_key" ON "ai_workspace_usage_periods"("workspaceId", "periodStart");
CREATE INDEX "ai_credentials_scope_provider_status_idx" ON "ai_credentials"("scope", "provider", "status");
CREATE INDEX "ai_credentials_workspaceId_provider_status_idx" ON "ai_credentials"("workspaceId", "provider", "status");
CREATE INDEX "ai_credentials_userId_provider_status_idx" ON "ai_credentials"("userId", "provider", "status");
CREATE INDEX "ai_credentials_createdByUserId_idx" ON "ai_credentials"("createdByUserId");
CREATE UNIQUE INDEX "ai_credentials_active_owner_provider_key" ON "ai_credentials" ("scope", COALESCE("workspaceId", ''), COALESCE("userId", ''), "provider") WHERE "status" = 'ACTIVE' AND "isFallback" = false;
CREATE INDEX "AiUsagePeriod_workspaceId_periodStart_idx" ON "AiUsagePeriod"("workspaceId", "periodStart");
CREATE INDEX "AiTokenLedger_workspaceId_periodStart_idx" ON "AiTokenLedger"("workspaceId", "periodStart");
CREATE INDEX "AiTokenLedger_credentialId_idx" ON "AiTokenLedger"("credentialId");
CREATE UNIQUE INDEX "AiTokenLedger_idempotencyKey_key" ON "AiTokenLedger"("idempotencyKey");
CREATE INDEX "AiTokenLedger_credentialSource_createdAt_idx" ON "AiTokenLedger"("credentialSource", "createdAt" DESC);
CREATE INDEX "ai_credential_audit_events_workspaceId_createdAt_idx" ON "ai_credential_audit_events"("workspaceId", "createdAt" DESC);
CREATE INDEX "ai_credential_audit_events_credentialId_createdAt_idx" ON "ai_credential_audit_events"("credentialId", "createdAt" DESC);
CREATE INDEX "ai_credential_audit_events_actorUserId_createdAt_idx" ON "ai_credential_audit_events"("actorUserId", "createdAt" DESC);

ALTER TABLE "AiUsagePeriod" ADD CONSTRAINT "AiUsagePeriod_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiTokenLedger" ADD CONSTRAINT "AiTokenLedger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiTokenLedger" ADD CONSTRAINT "AiTokenLedger_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ai_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_credentials" ADD CONSTRAINT "ai_credentials_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_credentials" ADD CONSTRAINT "ai_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_credentials" ADD CONSTRAINT "ai_credentials_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_policies" ADD CONSTRAINT "ai_policies_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_credential_audit_events" ADD CONSTRAINT "ai_credential_audit_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_credential_audit_events" ADD CONSTRAINT "ai_credential_audit_events_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ai_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_credential_audit_events" ADD CONSTRAINT "ai_credential_audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_workspace_usage_periods" ADD CONSTRAINT "ai_workspace_usage_periods_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_user_workspace_usage_periods" ADD CONSTRAINT "ai_user_workspace_usage_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_user_workspace_usage_periods" ADD CONSTRAINT "ai_user_workspace_usage_periods_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "MembershipPlan" SET "allowKhipuChat" = true, "allowByok" = true WHERE "slug" IN ('pro', 'empresa');
UPDATE "MembershipPlan" SET "allowKhipuAgent" = true, "allowWorkspaceKey" = true, "allowAgentWrites" = true WHERE "slug" = 'empresa';
