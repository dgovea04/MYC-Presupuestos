CREATE TYPE "WorkspaceAuditAction" AS ENUM (
  'WORKSPACE_UPDATED',
  'WORKSPACE_DELETED',
  'OWNERSHIP_TRANSFERRED',
  'MEMBER_INVITED',
  'MEMBER_ROLE_CHANGED',
  'MEMBER_SUSPENDED',
  'MEMBER_REACTIVATED',
  'MEMBER_REMOVED',
  'INVITE_LINK_CREATED',
  'INVITE_LINK_REVOKED'
);

CREATE TYPE "WorkspaceAuditTargetType" AS ENUM ('WORKSPACE', 'MEMBER');

CREATE TABLE "workspace_audit_events" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" "WorkspaceAuditAction" NOT NULL,
  "targetType" "WorkspaceAuditTargetType" NOT NULL,
  "targetId" TEXT,
  "targetLabel" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workspace_audit_events_companyId_createdAt_idx" ON "workspace_audit_events"("companyId", "createdAt" DESC);
CREATE INDEX "workspace_audit_events_companyId_action_createdAt_idx" ON "workspace_audit_events"("companyId", "action", "createdAt" DESC);
CREATE INDEX "workspace_audit_events_actorUserId_createdAt_idx" ON "workspace_audit_events"("actorUserId", "createdAt" DESC);

ALTER TABLE "workspace_audit_events" ADD CONSTRAINT "workspace_audit_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_audit_events" ADD CONSTRAINT "workspace_audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
