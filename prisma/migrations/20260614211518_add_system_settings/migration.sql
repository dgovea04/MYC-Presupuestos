-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'system',
    "openaiApiKey" TEXT,
    "geminiApiKey" TEXT,
    "openaiModel" TEXT,
    "geminiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_singletonKey_key" ON "SystemSettings"("singletonKey");

-- CreateIndex
CREATE INDEX "SystemSettings_singletonKey_idx" ON "SystemSettings"("singletonKey");
