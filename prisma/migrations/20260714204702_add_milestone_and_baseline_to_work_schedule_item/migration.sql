-- AlterTable
ALTER TABLE "WorkScheduleItem" ADD COLUMN     "baselineEndDate" TIMESTAMP(3),
ADD COLUMN     "baselineStartDate" TIMESTAMP(3),
ADD COLUMN     "isMilestone" BOOLEAN NOT NULL DEFAULT false;
