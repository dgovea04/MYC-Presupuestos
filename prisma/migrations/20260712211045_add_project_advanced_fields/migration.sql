-- CreateEnum
CREATE TYPE "ProjectCategory" AS ENUM ('EDIFICACION', 'INFRAESTRUCTURA_VIAL', 'SANEAMIENTO', 'ELECTRICO', 'MINERO', 'INDUSTRIAL', 'HABILITACION_URBANA', 'OTRO');

-- CreateEnum
CREATE TYPE "BuildingSubtype" AS ENUM ('UNIFAMILIAR', 'MULTIFAMILIAR', 'COMERCIAL', 'OFICINAS', 'EDUCACIONAL', 'HOSPITALARIO', 'HOTELERO', 'MIXTO', 'OTRO');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('SUMA_ALZADA', 'PRECIOS_UNITARIOS', 'MIXTO', 'ADMINISTRACION');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "basements" INTEGER,
ADD COLUMN     "buildingHeight" DECIMAL(10,4),
ADD COLUMN     "buildingSubtype" "BuildingSubtype",
ADD COLUMN     "builtArea" DECIMAL(14,4),
ADD COLUMN     "contractAmount" DECIMAL(18,4),
ADD COLUMN     "contractType" "ContractType",
ADD COLUMN     "district" TEXT,
ADD COLUMN     "executiveSummary" TEXT,
ADD COLUMN     "floors" INTEGER,
ADD COLUMN     "landArea" DECIMAL(14,4),
ADD COLUMN     "ownerEntity" TEXT,
ADD COLUMN     "projectCategory" "ProjectCategory",
ADD COLUMN     "projectManager" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "referenceBudget" DECIMAL(18,4),
ADD COLUMN     "region" TEXT,
ADD COLUMN     "supervisor" TEXT;
