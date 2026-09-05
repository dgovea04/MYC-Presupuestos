CREATE TYPE "ReviewDocumentStorageProvider" AS ENUM ('LOCAL');

CREATE TYPE "ExtractionCoverage" AS ENUM ('PROCESSED', 'OCR_REQUIRED', 'FAILED');

CREATE TYPE "ExtractionMethod" AS ENUM ('PDF_TEXT', 'XLSX_CELL_RANGE', 'OCR_PROVIDER', 'OCR_UNAVAILABLE');

ALTER TABLE "DocumentVersion"
  ADD COLUMN "storageProvider" "ReviewDocumentStorageProvider" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "storageMetadata" JSONB,
  ADD COLUMN "extractionMethod" "ExtractionMethod",
  ADD COLUMN "extractionConfidence" "ConfidenceLevel",
  ADD COLUMN "extractionCoverage" JSONB;
