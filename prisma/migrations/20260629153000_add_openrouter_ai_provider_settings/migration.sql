ALTER TABLE "UserSettings"
  ADD COLUMN "openrouterApiKey" TEXT,
  ADD COLUMN "openrouterModel" TEXT;

ALTER TABLE "SystemSettings"
  ADD COLUMN "openrouterApiKey" TEXT,
  ADD COLUMN "openrouterModel" TEXT;
