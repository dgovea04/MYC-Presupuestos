-- CreateEnum
CREATE TYPE "GeneralExpenseGroupKind" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "GeneralExpenseItemCategory" AS ENUM ('STANDARD', 'PERSONAL', 'TESTING', 'DIRECT_COST_BASED');

-- CreateTable
CREATE TABLE "GeneralExpenseGroup" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "GeneralExpenseGroupKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneralExpenseGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralExpenseTitle" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneralExpenseTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralExpenseItem" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "GeneralExpenseItemCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "quantityDescription" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "participationPercentage" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneralExpenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneralExpenseGroup_budgetId_idx" ON "GeneralExpenseGroup"("budgetId");

-- CreateIndex
CREATE INDEX "GeneralExpenseTitle_groupId_idx" ON "GeneralExpenseTitle"("groupId");

-- CreateIndex
CREATE INDEX "GeneralExpenseItem_titleId_idx" ON "GeneralExpenseItem"("titleId");

-- AddForeignKey
ALTER TABLE "GeneralExpenseGroup" ADD CONSTRAINT "GeneralExpenseGroup_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralExpenseTitle" ADD CONSTRAINT "GeneralExpenseTitle_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GeneralExpenseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralExpenseItem" ADD CONSTRAINT "GeneralExpenseItem_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "GeneralExpenseTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
