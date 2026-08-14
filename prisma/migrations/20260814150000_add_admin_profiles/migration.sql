CREATE TYPE "AdminProfile" AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'SUPPORT',
  'BILLING_ADMIN',
  'AUDITOR'
);

ALTER TABLE "User"
ADD COLUMN "adminProfile" "AdminProfile";

UPDATE "User"
SET "adminProfile" = CASE
  WHEN "isSuperAdmin" = true THEN 'SUPER_ADMIN'::"AdminProfile"
  WHEN "role" = 'ADMIN' THEN 'ADMIN'::"AdminProfile"
  ELSE NULL
END;

CREATE INDEX "User_adminProfile_idx" ON "User"("adminProfile");
