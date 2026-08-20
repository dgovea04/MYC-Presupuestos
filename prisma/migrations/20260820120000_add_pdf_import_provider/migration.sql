ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "pdfImportProvider" TEXT NOT NULL DEFAULT 'openai';
