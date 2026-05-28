-- AlterTable
-- No existing rows are modified. New traceability tables are additive.

-- CreateTable
CREATE TABLE "GeneratedPartida" (
    "id" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "generatedName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "similarityScore" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "generatedCatalogPartidaId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedPartida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedPartidaSource" (
    "id" TEXT NOT NULL,
    "generatedPartidaId" TEXT NOT NULL,
    "partidaSourceId" TEXT NOT NULL,
    "score" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedPartidaSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedPartidaInsumo" (
    "id" TEXT NOT NULL,
    "generatedPartidaId" TEXT NOT NULL,
    "resourceId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "resourceType" TEXT,
    "suggestedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "finalQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "confidence" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "confidenceLevel" TEXT NOT NULL,
    "calculationMethod" TEXT NOT NULL,
    "sourcePartidaIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "statistics" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedPartidaInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedPartida_createdById_createdAt_idx" ON "GeneratedPartida"("createdById", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeneratedPartida_generatedCatalogPartidaId_idx" ON "GeneratedPartida"("generatedCatalogPartidaId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedPartidaSource_generatedPartidaId_partidaSourceId_key" ON "GeneratedPartidaSource"("generatedPartidaId", "partidaSourceId");

-- CreateIndex
CREATE INDEX "GeneratedPartidaSource_partidaSourceId_idx" ON "GeneratedPartidaSource"("partidaSourceId");

-- CreateIndex
CREATE INDEX "GeneratedPartidaInsumo_generatedPartidaId_idx" ON "GeneratedPartidaInsumo"("generatedPartidaId");

-- CreateIndex
CREATE INDEX "GeneratedPartidaInsumo_resourceId_idx" ON "GeneratedPartidaInsumo"("resourceId");

-- AddForeignKey
ALTER TABLE "GeneratedPartida"
ADD CONSTRAINT "GeneratedPartida_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPartida"
ADD CONSTRAINT "GeneratedPartida_generatedCatalogPartidaId_fkey"
FOREIGN KEY ("generatedCatalogPartidaId") REFERENCES "CatalogPartida"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPartidaSource"
ADD CONSTRAINT "GeneratedPartidaSource_generatedPartidaId_fkey"
FOREIGN KEY ("generatedPartidaId") REFERENCES "GeneratedPartida"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPartidaSource"
ADD CONSTRAINT "GeneratedPartidaSource_partidaSourceId_fkey"
FOREIGN KEY ("partidaSourceId") REFERENCES "CatalogPartida"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPartidaInsumo"
ADD CONSTRAINT "GeneratedPartidaInsumo_generatedPartidaId_fkey"
FOREIGN KEY ("generatedPartidaId") REFERENCES "GeneratedPartida"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPartidaInsumo"
ADD CONSTRAINT "GeneratedPartidaInsumo_resourceId_fkey"
FOREIGN KEY ("resourceId") REFERENCES "Resource"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
