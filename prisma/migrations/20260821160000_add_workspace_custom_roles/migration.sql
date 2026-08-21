ALTER TYPE "WorkspaceAuditAction" ADD VALUE 'WORKSPACE_ROLE_CREATED';
ALTER TYPE "WorkspaceAuditAction" ADD VALUE 'WORKSPACE_ROLE_UPDATED';
ALTER TYPE "WorkspaceAuditAction" ADD VALUE 'WORKSPACE_ROLE_DELETED';
ALTER TYPE "WorkspaceAuditTargetType" ADD VALUE 'WORKSPACE_ROLE';

CREATE TABLE "workspace_permissions" (
  "key" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_permissions_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "workspace_roles" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_roles_companyId_name_key" ON "workspace_roles"("companyId", "name");
CREATE INDEX "workspace_roles_companyId_idx" ON "workspace_roles"("companyId");

CREATE TABLE "workspace_role_permissions" (
  "workspaceRoleId" TEXT NOT NULL,
  "permissionKey" TEXT NOT NULL,
  CONSTRAINT "workspace_role_permissions_pkey" PRIMARY KEY ("workspaceRoleId", "permissionKey")
);

CREATE INDEX "workspace_role_permissions_permissionKey_idx" ON "workspace_role_permissions"("permissionKey");

ALTER TABLE "workspace_roles" ADD CONSTRAINT "workspace_roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_role_permissions" ADD CONSTRAINT "workspace_role_permissions_workspaceRoleId_fkey" FOREIGN KEY ("workspaceRoleId") REFERENCES "workspace_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_role_permissions" ADD CONSTRAINT "workspace_role_permissions_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "workspace_permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_memberships" ADD COLUMN "customRoleId" TEXT;

ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "workspace_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
