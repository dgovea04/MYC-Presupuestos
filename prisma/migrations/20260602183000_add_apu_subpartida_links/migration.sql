ALTER TABLE "PartidaApuRow" ADD COLUMN IF NOT EXISTS "catalogSubpartidaId" TEXT;
ALTER TABLE "ApuResource" ADD COLUMN IF NOT EXISTS "catalogPartidaId" TEXT;
ALTER TABLE "ApuResource" ADD COLUMN IF NOT EXISTS "nestedApuRows" JSONB;

ALTER TABLE "ApuResource" ALTER COLUMN "resourceId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "PartidaApuRow_catalogSubpartidaId_idx" ON "PartidaApuRow"("catalogSubpartidaId");
CREATE INDEX IF NOT EXISTS "ApuResource_catalogPartidaId_idx" ON "ApuResource"("catalogPartidaId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PartidaApuRow_catalogSubpartidaId_fkey'
  ) THEN
    ALTER TABLE "PartidaApuRow"
      ADD CONSTRAINT "PartidaApuRow_catalogSubpartidaId_fkey"
      FOREIGN KEY ("catalogSubpartidaId") REFERENCES "CatalogPartida"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApuResource_catalogPartidaId_fkey'
  ) THEN
    ALTER TABLE "ApuResource"
      ADD CONSTRAINT "ApuResource_catalogPartidaId_fkey"
      FOREIGN KEY ("catalogPartidaId") REFERENCES "CatalogPartida"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

WITH subpartida_matches AS (
  SELECT row.id AS row_id, linked.id AS linked_partida_id
  FROM "PartidaApuRow" row
  JOIN "CatalogPartida" owner ON owner.id = row."catalogPartidaId"
  JOIN "CatalogPartida" linked
    ON upper(regexp_replace(trim(linked.description), '\s+', ' ', 'g')) = upper(regexp_replace(trim(row.description), '\s+', ' ', 'g'))
   AND upper(trim(linked.unit)) = upper(trim(row.unit))
   AND linked.id <> owner.id
  WHERE upper(regexp_replace(trim(coalesce(row."resourceType", row."groupLabel", '')), '\s+', ' ', 'g')) IN (
    'SUB PARTIDA',
    'SUB PARTIDAS',
    'SUBPARTIDA',
    'SUBPARTIDAS'
  )
)
UPDATE "PartidaApuRow" row
SET
  "catalogSubpartidaId" = subpartida_matches.linked_partida_id,
  "resourceId" = NULL,
  "resourceType" = 'SUBPARTIDA'
FROM subpartida_matches
WHERE row.id = subpartida_matches.row_id;
