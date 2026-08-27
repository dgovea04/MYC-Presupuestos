CREATE TYPE "AgentDelegationStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

CREATE TABLE "agent_delegations" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "delegatorId" TEXT NOT NULL,
  "delegateeId" TEXT NOT NULL,
  "projectId" TEXT,
  "teamId" TEXT,
  "toolNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "AgentDelegationStatus" NOT NULL DEFAULT 'ACTIVE',
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_delegations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_delegations_workspaceId_delegateeId_status_expiresAt_idx" ON "agent_delegations"("workspaceId", "delegateeId", "status", "expiresAt");
CREATE INDEX "agent_delegations_workspaceId_delegatorId_createdAt_idx" ON "agent_delegations"("workspaceId", "delegatorId", "createdAt");
CREATE INDEX "agent_delegations_projectId_teamId_idx" ON "agent_delegations"("projectId", "teamId");
ALTER TABLE "agent_delegations" ADD CONSTRAINT "agent_delegations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_delegations" ADD CONSTRAINT "agent_delegations_delegatorId_fkey" FOREIGN KEY ("delegatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_delegations" ADD CONSTRAINT "agent_delegations_delegateeId_fkey" FOREIGN KEY ("delegateeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_delegations" ADD CONSTRAINT "agent_delegations_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_delegations" ADD CONSTRAINT "agent_delegations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_delegations" ADD CONSTRAINT "agent_delegations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "workspace_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
