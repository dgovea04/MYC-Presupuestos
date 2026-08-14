ALTER TABLE "User"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "User_sessionVersion_idx"
  ON "User"("sessionVersion");
