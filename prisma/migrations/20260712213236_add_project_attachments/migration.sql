-- CreateEnum
CREATE TYPE "ProjectAttachmentCategory" AS ENUM ('PLANO', 'ESPECIFICACION', 'CONTRATO', 'MEMORIA', 'FOTO', 'OTRO');

-- CreateTable
CREATE TABLE "project_attachments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "category" "ProjectAttachmentCategory" NOT NULL DEFAULT 'OTRO',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_attachments_projectId_createdAt_idx" ON "project_attachments"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "project_attachments_userId_idx" ON "project_attachments"("userId");

-- CreateIndex
CREATE INDEX "project_attachments_category_idx" ON "project_attachments"("category");

-- AddForeignKey
ALTER TABLE "project_attachments" ADD CONSTRAINT "project_attachments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_attachments" ADD CONSTRAINT "project_attachments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
