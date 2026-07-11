/*
  Warnings:

  - Changed the type of `sourceType` on the `budget_item_generation_sources` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "BudgetItemGenerationSourceType" AS ENUM ('MCP_TEMPLATE', 'CATALOG_MATCH', 'AI_DESCRIPTION');

-- AlterTable
ALTER TABLE "budget_item_generation_sources" DROP COLUMN "sourceType",
ADD COLUMN     "sourceType" "BudgetItemGenerationSourceType" NOT NULL;

-- CreateIndex
CREATE INDEX "budget_item_generation_sources_sourceType_idx" ON "budget_item_generation_sources"("sourceType");
