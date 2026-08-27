ALTER TABLE "ai_policies" ADD COLUMN IF NOT EXISTS "teamId" TEXT;
ALTER TABLE "ai_policies" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_policies_teamId_key" ON "ai_policies"("teamId");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_policies_projectId_key" ON "ai_policies"("projectId");
CREATE INDEX IF NOT EXISTS "ai_policies_teamId_idx" ON "ai_policies"("teamId");
CREATE INDEX IF NOT EXISTS "ai_policies_projectId_idx" ON "ai_policies"("projectId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_policies_teamId_fkey') THEN
    ALTER TABLE "ai_policies" ADD CONSTRAINT "ai_policies_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "workspace_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_policies_projectId_fkey') THEN
    ALTER TABLE "ai_policies" ADD CONSTRAINT "ai_policies_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "ai_policies" DROP CONSTRAINT IF EXISTS "ai_policies_scope_owner_check";
ALTER TABLE "ai_policies" ADD CONSTRAINT "ai_policies_scope_owner_check" CHECK (
  ("workspaceId" IS NOT NULL AND "teamId" IS NULL AND "projectId" IS NULL)
  OR ("workspaceId" IS NULL AND "teamId" IS NOT NULL AND "projectId" IS NULL)
  OR ("workspaceId" IS NULL AND "teamId" IS NULL AND "projectId" IS NOT NULL)
);
