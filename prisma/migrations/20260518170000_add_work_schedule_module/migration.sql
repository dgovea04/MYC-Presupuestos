CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkScheduleItem" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "predecessor" TEXT,
    "crew" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkScheduleItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkScheduleDistribution" (
    "id" TEXT NOT NULL,
    "scheduleItemId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "percentage" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkScheduleDistribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkSchedule_budgetId_key" ON "WorkSchedule"("budgetId");
CREATE INDEX "WorkSchedule_budgetId_idx" ON "WorkSchedule"("budgetId");

CREATE UNIQUE INDEX "WorkScheduleItem_scheduleId_budgetItemId_key" ON "WorkScheduleItem"("scheduleId", "budgetItemId");
CREATE INDEX "WorkScheduleItem_scheduleId_idx" ON "WorkScheduleItem"("scheduleId");
CREATE INDEX "WorkScheduleItem_budgetItemId_idx" ON "WorkScheduleItem"("budgetItemId");

CREATE UNIQUE INDEX "WorkScheduleDistribution_scheduleItemId_year_month_key" ON "WorkScheduleDistribution"("scheduleItemId", "year", "month");
CREATE INDEX "WorkScheduleDistribution_scheduleItemId_idx" ON "WorkScheduleDistribution"("scheduleItemId");
CREATE INDEX "WorkScheduleDistribution_year_month_idx" ON "WorkScheduleDistribution"("year", "month");

ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkScheduleItem" ADD CONSTRAINT "WorkScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkScheduleItem" ADD CONSTRAINT "WorkScheduleItem_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkScheduleDistribution" ADD CONSTRAINT "WorkScheduleDistribution_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "WorkScheduleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
