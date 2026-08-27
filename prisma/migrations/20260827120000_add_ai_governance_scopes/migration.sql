ALTER TYPE "AiCredentialScope" ADD VALUE IF NOT EXISTS 'TEAM';
ALTER TYPE "AiCredentialScope" ADD VALUE IF NOT EXISTS 'PROJECT';

CREATE TABLE "workspace_teams" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_teams_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "workspace_team_members" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_team_members_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ai_credentials" ADD COLUMN "teamId" TEXT;
ALTER TABLE "ai_credentials" ADD COLUMN "projectId" TEXT;
CREATE UNIQUE INDEX "workspace_teams_companyId_name_key" ON "workspace_teams"("companyId", "name");
CREATE INDEX "workspace_teams_companyId_idx" ON "workspace_teams"("companyId");
CREATE UNIQUE INDEX "workspace_team_members_teamId_userId_key" ON "workspace_team_members"("teamId", "userId");
CREATE INDEX "workspace_team_members_companyId_userId_idx" ON "workspace_team_members"("companyId", "userId");
CREATE INDEX "workspace_team_members_userId_idx" ON "workspace_team_members"("userId");
CREATE INDEX "ai_credentials_teamId_provider_status_idx" ON "ai_credentials"("teamId", "provider", "status");
CREATE INDEX "ai_credentials_projectId_provider_status_idx" ON "ai_credentials"("projectId", "provider", "status");
ALTER TABLE "workspace_teams" ADD CONSTRAINT "workspace_teams_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_team_members" ADD CONSTRAINT "workspace_team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "workspace_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_team_members" ADD CONSTRAINT "workspace_team_members_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_team_members" ADD CONSTRAINT "workspace_team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_credentials" ADD CONSTRAINT "ai_credentials_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "workspace_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_credentials" ADD CONSTRAINT "ai_credentials_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_credentials" ADD CONSTRAINT "ai_credentials_scope_owner_check" CHECK (("scope" = 'PLATFORM' AND "workspaceId" IS NULL AND "teamId" IS NULL AND "projectId" IS NULL AND "userId" IS NULL) OR ("scope" = 'WORKSPACE' AND "workspaceId" IS NOT NULL AND "teamId" IS NULL AND "projectId" IS NULL AND "userId" IS NULL) OR ("scope" = 'TEAM' AND "workspaceId" IS NULL AND "teamId" IS NOT NULL AND "projectId" IS NULL AND "userId" IS NULL) OR ("scope" = 'PROJECT' AND "workspaceId" IS NULL AND "teamId" IS NULL AND "projectId" IS NOT NULL AND "userId" IS NULL) OR ("scope" = 'USER' AND "workspaceId" IS NULL AND "teamId" IS NULL AND "projectId" IS NULL AND "userId" IS NOT NULL));
