-- CreateTable
CREATE TABLE "custom_metrado_formulas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Personalizado',
    "expression" TEXT NOT NULL,
    "requiredInputs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "resultUnit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_metrado_formulas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_metrado_formulas_userId_category_idx" ON "custom_metrado_formulas"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "custom_metrado_formulas_userId_name_key" ON "custom_metrado_formulas"("userId", "name");

-- AddForeignKey
ALTER TABLE "custom_metrado_formulas"
ADD CONSTRAINT "custom_metrado_formulas_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
