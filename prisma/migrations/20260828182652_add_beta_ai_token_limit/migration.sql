-- DropIndex
DROP INDEX "agent_delegations_workspaceId_delegatorId_createdAt_idx";

-- DropIndex
DROP INDEX "ai_policies_projectId_idx";

-- DropIndex
DROP INDEX "ai_policies_teamId_idx";

-- AlterTable
ALTER TABLE "ai_policies" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "beta_campaigns" ADD COLUMN     "aiTokenLimit" INTEGER;

-- CreateIndex
CREATE INDEX "agent_delegations_workspaceId_delegatorId_createdAt_idx" ON "agent_delegations"("workspaceId", "delegatorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_policies_mode_idx" ON "ai_policies"("mode");

-- CreateIndex
CREATE INDEX "ai_workspace_usage_periods_periodStart_idx" ON "ai_workspace_usage_periods"("periodStart");

-- RenameIndex
ALTER INDEX "ai_user_workspace_usage_periods_userId_workspaceId_periodStart_" RENAME TO "ai_user_workspace_usage_periods_userId_workspaceId_periodSt_key";
