-- CreateTable
CREATE TABLE "work_schedule_generation_settings" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customPhaseKeywords" JSONB DEFAULT '{}',

    CONSTRAINT "work_schedule_generation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_generation_settings_budgetId_key" ON "work_schedule_generation_settings"("budgetId");

-- CreateIndex
CREATE INDEX "work_schedule_generation_settings_budgetId_idx" ON "work_schedule_generation_settings"("budgetId");

-- AddForeignKey
ALTER TABLE "work_schedule_generation_settings" ADD CONSTRAINT "work_schedule_generation_settings_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
