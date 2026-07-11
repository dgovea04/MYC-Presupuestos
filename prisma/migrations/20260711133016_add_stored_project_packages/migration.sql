-- CreateTable
CREATE TABLE "stored_project_packages" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceProjectId" TEXT,
    "projectName" TEXT NOT NULL,
    "projectType" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "mcpContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stored_project_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stored_project_packages_companyId_createdAt_idx" ON "stored_project_packages"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "stored_project_packages_userId_idx" ON "stored_project_packages"("userId");

-- AddForeignKey
ALTER TABLE "stored_project_packages" ADD CONSTRAINT "stored_project_packages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_project_packages" ADD CONSTRAINT "stored_project_packages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_project_packages" ADD CONSTRAINT "stored_project_packages_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
