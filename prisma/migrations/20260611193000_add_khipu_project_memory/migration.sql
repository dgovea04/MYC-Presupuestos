-- CreateEnum
CREATE TYPE "AiProjectMemoryType" AS ENUM ('FACT', 'PREFERENCE', 'CONSTRAINT', 'ASSUMPTION');

-- CreateTable
CREATE TABLE "project_ai_memory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "memoryType" "AiProjectMemoryType" NOT NULL DEFAULT 'FACT',
    "fact" TEXT NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL DEFAULT 0.8,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_ai_memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_ai_memory_projectId_createdAt_idx" ON "project_ai_memory"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "project_ai_memory_memoryType_idx" ON "project_ai_memory"("memoryType");

-- AddForeignKey
ALTER TABLE "project_ai_memory" ADD CONSTRAINT "project_ai_memory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
