-- Add system-level agentModel for Khipu Agente parity with users.
-- Nullable: existing rows default to null, no data migration required.
ALTER TABLE "SystemSettings"
  ADD COLUMN "agentModel" TEXT;
