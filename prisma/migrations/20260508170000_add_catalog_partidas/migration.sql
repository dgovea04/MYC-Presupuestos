-- CreateTable
CREATE TABLE "CatalogPartida" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "source" TEXT,
    "performance" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "performanceUnit" TEXT,
    "performanceRate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogPartida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartidaApuRow" (
    "id" TEXT NOT NULL,
    "catalogPartidaId" TEXT NOT NULL,
    "resourceId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "crew" DECIMAL(18,4),
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "resourceType" TEXT,
    "groupLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartidaApuRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogPartida_description_idx" ON "CatalogPartida"("description");

-- CreateIndex
CREATE INDEX "PartidaApuRow_catalogPartidaId_idx" ON "PartidaApuRow"("catalogPartidaId");

-- CreateIndex
CREATE INDEX "PartidaApuRow_resourceId_idx" ON "PartidaApuRow"("resourceId");

-- AddForeignKey
ALTER TABLE "PartidaApuRow"
ADD CONSTRAINT "PartidaApuRow_catalogPartidaId_fkey"
FOREIGN KEY ("catalogPartidaId") REFERENCES "CatalogPartida"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartidaApuRow"
ADD CONSTRAINT "PartidaApuRow_resourceId_fkey"
FOREIGN KEY ("resourceId") REFERENCES "Resource"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
