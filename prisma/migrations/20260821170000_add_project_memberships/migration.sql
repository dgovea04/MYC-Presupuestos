ALTER TYPE "WorkspaceAuditAction" ADD VALUE 'PROJECT_SHARED';
ALTER TYPE "WorkspaceAuditAction" ADD VALUE 'PROJECT_UNSHARED';
ALTER TYPE "WorkspaceAuditTargetType" ADD VALUE 'PROJECT';

CREATE TYPE "ProjectAccessRole" AS ENUM ('VIEWER', 'EDITOR', 'ADMIN');

CREATE TABLE "project_memberships" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ProjectAccessRole" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_memberships_projectId_userId_key" ON "project_memberships"("projectId", "userId");
CREATE INDEX "project_memberships_companyId_userId_idx" ON "project_memberships"("companyId", "userId");
CREATE INDEX "project_memberships_projectId_idx" ON "project_memberships"("projectId");

ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
