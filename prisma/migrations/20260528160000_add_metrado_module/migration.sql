-- CreateEnum
CREATE TYPE "MetradoTemplateType" AS ENUM ('CONCRETE', 'REBAR', 'FORMWORK', 'MASONRY', 'PLASTER', 'PAINT', 'EXCAVATION', 'FLOORING', 'ROOFING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MetradoSheetStatus" AS ENUM ('DRAFT', 'VALIDATED', 'SENT_TO_BUDGET');

-- CreateTable
CREATE TABLE "metrado_templates" (
    "id" TEXT NOT NULL,
    "type" "MetradoTemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "defaultUnit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metrado_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrado_formulas" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "requiredInputs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "resultUnit" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metrado_formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrado_sheets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MetradoSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "unit" TEXT NOT NULL,
    "totalQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metrado_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrado_rows" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "sector" TEXT NOT NULL DEFAULT '',
    "eje" TEXT NOT NULL DEFAULT '',
    "nivel" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "formulaKey" TEXT NOT NULL,
    "inputs" JSONB NOT NULL DEFAULT '{}',
    "partial" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metrado_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrado_partida_links" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "lastSentQuantity" DECIMAL(18,4),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metrado_partida_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metrado_templates_type_key" ON "metrado_templates"("type");

-- CreateIndex
CREATE UNIQUE INDEX "metrado_formulas_templateId_key_key" ON "metrado_formulas"("templateId", "key");

-- CreateIndex
CREATE INDEX "metrado_formulas_templateId_idx" ON "metrado_formulas"("templateId");

-- CreateIndex
CREATE INDEX "metrado_sheets_userId_updatedAt_idx" ON "metrado_sheets"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "metrado_sheets_projectId_idx" ON "metrado_sheets"("projectId");

-- CreateIndex
CREATE INDEX "metrado_sheets_budgetId_idx" ON "metrado_sheets"("budgetId");

-- CreateIndex
CREATE INDEX "metrado_sheets_templateId_idx" ON "metrado_sheets"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "metrado_sheets_id_budgetId_key" ON "metrado_sheets"("id", "budgetId");

-- CreateIndex
CREATE INDEX "metrado_rows_sheetId_sortOrder_idx" ON "metrado_rows"("sheetId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "metrado_partida_links_sheetId_budgetItemId_key" ON "metrado_partida_links"("sheetId", "budgetItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetItem_id_budgetId_key" ON "BudgetItem"("id", "budgetId");

-- CreateIndex
CREATE INDEX "metrado_partida_links_sheetId_budgetId_idx" ON "metrado_partida_links"("sheetId", "budgetId");

-- CreateIndex
CREATE INDEX "metrado_partida_links_budgetItemId_idx" ON "metrado_partida_links"("budgetItemId");

-- CreateIndex
CREATE INDEX "metrado_partida_links_budgetItemId_budgetId_idx" ON "metrado_partida_links"("budgetItemId", "budgetId");

-- AddForeignKey
ALTER TABLE "metrado_formulas"
ADD CONSTRAINT "metrado_formulas_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "metrado_templates"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrado_sheets"
ADD CONSTRAINT "metrado_sheets_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrado_sheets"
ADD CONSTRAINT "metrado_sheets_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrado_sheets"
ADD CONSTRAINT "metrado_sheets_budgetId_projectId_fkey"
FOREIGN KEY ("budgetId", "projectId") REFERENCES "Budget"("id", "projectId")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrado_sheets"
ADD CONSTRAINT "metrado_sheets_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "metrado_templates"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrado_rows"
ADD CONSTRAINT "metrado_rows_sheetId_fkey"
FOREIGN KEY ("sheetId") REFERENCES "metrado_sheets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrado_partida_links"
ADD CONSTRAINT "metrado_partida_links_sheetId_budgetId_fkey"
FOREIGN KEY ("sheetId", "budgetId") REFERENCES "metrado_sheets"("id", "budgetId")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrado_partida_links"
ADD CONSTRAINT "metrado_partida_links_budgetItemId_budgetId_fkey"
FOREIGN KEY ("budgetItemId", "budgetId") REFERENCES "BudgetItem"("id", "budgetId")
ON DELETE CASCADE ON UPDATE CASCADE;
