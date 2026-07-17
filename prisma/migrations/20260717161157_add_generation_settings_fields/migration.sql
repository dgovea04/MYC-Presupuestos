-- AlterTable
ALTER TABLE "work_schedule_generation_settings" ADD COLUMN     "interSubBudgetParallelism" TEXT DEFAULT 'independent',
ADD COLUMN     "interSubBudgetStaggerDays" INTEGER DEFAULT 7,
ADD COLUMN     "levelLinkage" JSONB DEFAULT '{}',
ADD COLUMN     "maxDurationDays" INTEGER,
ADD COLUMN     "similarityLagDays" INTEGER DEFAULT 0,
ADD COLUMN     "strategy" TEXT DEFAULT 'sequential';
