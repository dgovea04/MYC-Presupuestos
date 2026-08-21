CREATE TABLE "workspace_invite_links" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "role" "CompanyMembershipRole" NOT NULL DEFAULT 'VIEWER',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "maxUses" INTEGER,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_invite_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workspace_invite_links_tokenHash_key" ON "workspace_invite_links"("tokenHash");
CREATE INDEX "workspace_invite_links_companyId_revokedAt_expiresAt_idx" ON "workspace_invite_links"("companyId", "revokedAt", "expiresAt");
CREATE INDEX "workspace_invite_links_createdById_idx" ON "workspace_invite_links"("createdById");

CREATE TABLE "workspace_invite_link_uses" (
  "id" TEXT NOT NULL,
  "inviteLinkId" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "membershipId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_invite_link_uses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workspace_invite_link_uses_inviteLinkId_email_key" ON "workspace_invite_link_uses"("inviteLinkId", "email");
CREATE INDEX "workspace_invite_link_uses_inviteLinkId_createdAt_idx" ON "workspace_invite_link_uses"("inviteLinkId", "createdAt" DESC);
CREATE INDEX "workspace_invite_link_uses_userId_idx" ON "workspace_invite_link_uses"("userId");

ALTER TABLE "workspace_invite_links" ADD CONSTRAINT "workspace_invite_links_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_invite_links" ADD CONSTRAINT "workspace_invite_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_invite_link_uses" ADD CONSTRAINT "workspace_invite_link_uses_inviteLinkId_fkey" FOREIGN KEY ("inviteLinkId") REFERENCES "workspace_invite_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_invite_link_uses" ADD CONSTRAINT "workspace_invite_link_uses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
