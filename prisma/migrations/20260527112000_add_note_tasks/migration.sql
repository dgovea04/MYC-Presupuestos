-- CreateEnum
CREATE TYPE "NoteTaskPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "NoteTaskStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "NoteTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "budgetId" TEXT,
    "budgetItemId" TEXT,
    "body" TEXT NOT NULL,
    "priority" "NoteTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "NoteTaskStatus" NOT NULL DEFAULT 'OPEN',
    "sourcePath" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteTask_userId_status_updatedAt_idx" ON "NoteTask"("userId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "NoteTask_projectId_idx" ON "NoteTask"("projectId");

-- CreateIndex
CREATE INDEX "NoteTask_budgetId_idx" ON "NoteTask"("budgetId");

-- CreateIndex
CREATE INDEX "NoteTask_budgetItemId_idx" ON "NoteTask"("budgetItemId");

-- CreateIndex
CREATE INDEX "NoteTask_sourcePath_idx" ON "NoteTask"("sourcePath");

-- AddForeignKey
ALTER TABLE "NoteTask" ADD CONSTRAINT "NoteTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTask" ADD CONSTRAINT "NoteTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTask" ADD CONSTRAINT "NoteTask_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTask" ADD CONSTRAINT "NoteTask_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
