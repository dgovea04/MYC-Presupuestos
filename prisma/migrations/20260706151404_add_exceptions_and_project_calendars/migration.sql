/*
  Warnings:

  - You are about to drop the column `workCalendarId` on the `Project` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "work_calendar_exceptions" (
    "id" TEXT NOT NULL,
    "workCalendarId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'HOLIDAY',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_calendar_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_work_calendars" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workCalendarId" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_work_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_calendar_exceptions_workCalendarId_idx" ON "work_calendar_exceptions"("workCalendarId");

-- CreateIndex
CREATE UNIQUE INDEX "work_calendar_exceptions_workCalendarId_date_key" ON "work_calendar_exceptions"("workCalendarId", "date");

-- CreateIndex
CREATE INDEX "project_work_calendars_projectId_idx" ON "project_work_calendars"("projectId");

-- CreateIndex
CREATE INDEX "project_work_calendars_workCalendarId_idx" ON "project_work_calendars"("workCalendarId");

-- CreateIndex
CREATE UNIQUE INDEX "project_work_calendars_projectId_workCalendarId_key" ON "project_work_calendars"("projectId", "workCalendarId");

-- AddForeignKey
ALTER TABLE "work_calendar_exceptions" ADD CONSTRAINT "work_calendar_exceptions_workCalendarId_fkey" FOREIGN KEY ("workCalendarId") REFERENCES "work_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_calendars" ADD CONSTRAINT "project_work_calendars_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_calendars" ADD CONSTRAINT "project_work_calendars_workCalendarId_fkey" FOREIGN KEY ("workCalendarId") REFERENCES "work_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: copy existing workCalendarId values to junction table
INSERT INTO "project_work_calendars" ("id", "projectId", "workCalendarId", "label", "sortOrder", "createdAt")
SELECT gen_random_uuid()::text, "id", "workCalendarId", NULL, 0, NOW()
FROM "Project"
WHERE "workCalendarId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "public"."Project" DROP CONSTRAINT "Project_workCalendarId_fkey";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "workCalendarId";
