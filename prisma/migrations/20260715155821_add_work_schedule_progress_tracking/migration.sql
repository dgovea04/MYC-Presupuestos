-- AlterTable
ALTER TABLE "WorkScheduleItem" ADD COLUMN     "actualEndDate" TIMESTAMP(3),
ADD COLUMN     "actualStartDate" TIMESTAMP(3),
ADD COLUMN     "percentComplete" DECIMAL(5,2);
