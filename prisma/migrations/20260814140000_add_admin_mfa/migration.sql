ALTER TABLE "User"
ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfaSecretEncrypted" TEXT;

CREATE TABLE "admin_mfa_recovery_codes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_mfa_recovery_codes_codeHash_key"
  ON "admin_mfa_recovery_codes"("codeHash");
CREATE INDEX "admin_mfa_recovery_codes_userId_usedAt_idx"
  ON "admin_mfa_recovery_codes"("userId", "usedAt");

ALTER TABLE "admin_mfa_recovery_codes"
ADD CONSTRAINT "admin_mfa_recovery_codes_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
