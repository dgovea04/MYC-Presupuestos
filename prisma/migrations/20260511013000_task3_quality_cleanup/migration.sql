UPDATE "UnifiedIndex"
SET "geographicArea" = 'UNSPECIFIED'
WHERE "geographicArea" IS NULL;

ALTER TABLE "UnifiedIndex"
ALTER COLUMN "geographicArea" SET DEFAULT 'UNSPECIFIED';

ALTER TABLE "UnifiedIndex"
ALTER COLUMN "geographicArea" SET NOT NULL;

DROP INDEX IF EXISTS "AdjustmentCalculation_valuationId_idx";
