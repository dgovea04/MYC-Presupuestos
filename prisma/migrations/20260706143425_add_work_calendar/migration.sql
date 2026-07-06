-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "workCalendarId" TEXT;

-- CreateTable
CREATE TABLE "work_calendars" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workDays" INTEGER NOT NULL DEFAULT 31,
    "workHoursPerDay" DECIMAL(6,2) NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_calendars_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workCalendarId_fkey" FOREIGN KEY ("workCalendarId") REFERENCES "work_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
