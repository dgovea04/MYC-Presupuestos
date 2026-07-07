-- CreateEnum
CREATE TYPE "CollaborationEntityType" AS ENUM ('BUDGET', 'BUDGET_ITEM', 'APU', 'APU_RESOURCE', 'METRADO_SHEET', 'METRADO_ROW', 'WORK_SCHEDULE_ITEM');

-- CreateEnum
CREATE TYPE "CollaborationPresenceStatus" AS ENUM ('ACTIVE', 'IDLE');

-- CreateEnum
CREATE TYPE "CollaborationChangeSource" AS ENUM ('USER', 'SYSTEM', 'KHIPU');

-- CreateTable
CREATE TABLE "collaboration_presence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "status" "CollaborationPresenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_presence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_edit_sessions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "CollaborationEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_edit_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_comments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "entityType" "CollaborationEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "body" TEXT NOT NULL,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_change_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "entityType" "CollaborationEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "diffSummary" TEXT,
    "source" "CollaborationChangeSource" NOT NULL DEFAULT 'USER',
    "userId" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_change_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_version_snapshots" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "reason" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_version_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collaboration_presence_budgetId_expiresAt_idx" ON "collaboration_presence"("budgetId", "expiresAt");

-- CreateIndex
CREATE INDEX "collaboration_presence_projectId_idx" ON "collaboration_presence"("projectId");

-- CreateIndex
CREATE INDEX "collaboration_presence_companyId_idx" ON "collaboration_presence"("companyId");

-- CreateIndex
CREATE INDEX "collaboration_presence_expiresAt_idx" ON "collaboration_presence"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_presence_budgetId_userId_key" ON "collaboration_presence"("budgetId", "userId");

-- CreateIndex
CREATE INDEX "collaboration_edit_sessions_budgetId_entityType_entityId_idx" ON "collaboration_edit_sessions"("budgetId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "collaboration_edit_sessions_expiresAt_idx" ON "collaboration_edit_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "collaboration_edit_sessions_userId_idx" ON "collaboration_edit_sessions"("userId");

-- CreateIndex
CREATE INDEX "collaboration_comments_budgetId_entityType_entityId_created_idx" ON "collaboration_comments"("budgetId", "entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "collaboration_comments_parentCommentId_idx" ON "collaboration_comments"("parentCommentId");

-- CreateIndex
CREATE INDEX "collaboration_comments_companyId_idx" ON "collaboration_comments"("companyId");

-- CreateIndex
CREATE INDEX "collaboration_comments_createdById_idx" ON "collaboration_comments"("createdById");

-- CreateIndex
CREATE INDEX "budget_change_events_budgetId_createdAt_idx" ON "budget_change_events"("budgetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "budget_change_events_entityType_entityId_idx" ON "budget_change_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "budget_change_events_companyId_idx" ON "budget_change_events"("companyId");

-- CreateIndex
CREATE INDEX "budget_change_events_userId_idx" ON "budget_change_events"("userId");

-- CreateIndex
CREATE INDEX "budget_version_snapshots_budgetId_createdAt_idx" ON "budget_version_snapshots"("budgetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "budget_version_snapshots_companyId_idx" ON "budget_version_snapshots"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_version_snapshots_budgetId_versionNumber_key" ON "budget_version_snapshots"("budgetId", "versionNumber");

-- AddForeignKey
ALTER TABLE "collaboration_presence" ADD CONSTRAINT "collaboration_presence_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_presence" ADD CONSTRAINT "collaboration_presence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_presence" ADD CONSTRAINT "collaboration_presence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_presence" ADD CONSTRAINT "collaboration_presence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_edit_sessions" ADD CONSTRAINT "collaboration_edit_sessions_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_edit_sessions" ADD CONSTRAINT "collaboration_edit_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_edit_sessions" ADD CONSTRAINT "collaboration_edit_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_edit_sessions" ADD CONSTRAINT "collaboration_edit_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_comments" ADD CONSTRAINT "collaboration_comments_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_comments" ADD CONSTRAINT "collaboration_comments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_comments" ADD CONSTRAINT "collaboration_comments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_comments" ADD CONSTRAINT "collaboration_comments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_comments" ADD CONSTRAINT "collaboration_comments_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_comments" ADD CONSTRAINT "collaboration_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "collaboration_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_change_events" ADD CONSTRAINT "budget_change_events_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_change_events" ADD CONSTRAINT "budget_change_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_change_events" ADD CONSTRAINT "budget_change_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_change_events" ADD CONSTRAINT "budget_change_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_version_snapshots" ADD CONSTRAINT "budget_version_snapshots_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_version_snapshots" ADD CONSTRAINT "budget_version_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_version_snapshots" ADD CONSTRAINT "budget_version_snapshots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_version_snapshots" ADD CONSTRAINT "budget_version_snapshots_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
