-- CreateTable
CREATE TABLE "budget_item_generation_sources" (
    "id" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourcePackageId" TEXT,
    "sourceCatalogPartidaId" TEXT,
    "sourceItemId" TEXT,
    "catalogMatchScore" DECIMAL(10,4),
    "quantityConfidence" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_item_generation_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budget_item_generation_sources_budgetItemId_key" ON "budget_item_generation_sources"("budgetItemId");

-- CreateIndex
CREATE INDEX "budget_item_generation_sources_budgetId_createdAt_idx" ON "budget_item_generation_sources"("budgetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "budget_item_generation_sources_sourceType_idx" ON "budget_item_generation_sources"("sourceType");

-- CreateIndex
CREATE INDEX "budget_item_generation_sources_sourcePackageId_idx" ON "budget_item_generation_sources"("sourcePackageId");

-- AddForeignKey
ALTER TABLE "budget_item_generation_sources" ADD CONSTRAINT "budget_item_generation_sources_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_item_generation_sources" ADD CONSTRAINT "budget_item_generation_sources_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_item_generation_sources" ADD CONSTRAINT "budget_item_generation_sources_sourcePackageId_fkey" FOREIGN KEY ("sourcePackageId") REFERENCES "stored_project_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_item_generation_sources" ADD CONSTRAINT "budget_item_generation_sources_sourceCatalogPartidaId_fkey" FOREIGN KEY ("sourceCatalogPartidaId") REFERENCES "CatalogPartida"("id") ON DELETE SET NULL ON UPDATE CASCADE;
