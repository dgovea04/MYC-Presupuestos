-- CreateTable
CREATE TABLE "agent_executions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'chat',
    "state" TEXT NOT NULL DEFAULT 'READ',
    "goal" TEXT NOT NULL,
    "summary" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "contextSnapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_execution_steps" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "toolName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "inputJson" JSONB,
    "resultSummary" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_execution_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tool_invocations" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT,
    "toolName" TEXT NOT NULL,
    "argumentsJson" JSONB NOT NULL,
    "resultJson" JSONB,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_tool_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_approvals" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT,
    "decision" TEXT,
    "reason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_rollbacks" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT,
    "rollbackToolName" TEXT NOT NULL,
    "rollbackInputJson" JSONB,
    "rollbackResultJson" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_rollbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_workflows" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "initialGoalTemplate" TEXT NOT NULL,
    "allowedToolsJson" JSONB,
    "defaultMode" TEXT NOT NULL DEFAULT 'goal',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_executions_userId_createdAt_idx" ON "agent_executions"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "agent_executions_projectId_idx" ON "agent_executions"("projectId");

-- CreateIndex
CREATE INDEX "agent_executions_state_createdAt_idx" ON "agent_executions"("state", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "agent_execution_steps_executionId_sequence_idx" ON "agent_execution_steps"("executionId", "sequence");

-- CreateIndex
CREATE INDEX "agent_tool_invocations_executionId_createdAt_idx" ON "agent_tool_invocations"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "agent_tool_invocations_stepId_idx" ON "agent_tool_invocations"("stepId");

-- CreateIndex
CREATE INDEX "agent_tool_invocations_toolName_createdAt_idx" ON "agent_tool_invocations"("toolName", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "agent_approvals_executionId_idx" ON "agent_approvals"("executionId");

-- CreateIndex
CREATE INDEX "agent_approvals_stepId_idx" ON "agent_approvals"("stepId");

-- CreateIndex
CREATE INDEX "agent_approvals_decidedByUserId_idx" ON "agent_approvals"("decidedByUserId");

-- CreateIndex
CREATE INDEX "agent_rollbacks_executionId_idx" ON "agent_rollbacks"("executionId");

-- CreateIndex
CREATE INDEX "agent_rollbacks_stepId_idx" ON "agent_rollbacks"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_workflows_slug_key" ON "agent_workflows"("slug");

-- CreateIndex
CREATE INDEX "agent_workflows_slug_idx" ON "agent_workflows"("slug");

-- CreateIndex
CREATE INDEX "agent_workflows_isActive_idx" ON "agent_workflows"("isActive");

-- AddForeignKey
ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_execution_steps" ADD CONSTRAINT "agent_execution_steps_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "agent_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tool_invocations" ADD CONSTRAINT "agent_tool_invocations_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "agent_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tool_invocations" ADD CONSTRAINT "agent_tool_invocations_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "agent_execution_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "agent_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "agent_execution_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_approvals" ADD CONSTRAINT "agent_approvals_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_rollbacks" ADD CONSTRAINT "agent_rollbacks_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "agent_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_rollbacks" ADD CONSTRAINT "agent_rollbacks_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "agent_execution_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_rollbacks" ADD CONSTRAINT "agent_rollbacks_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
