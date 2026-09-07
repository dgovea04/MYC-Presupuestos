CREATE TABLE "private_learning_policies" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "retentionDays" INTEGER NOT NULL DEFAULT 365,
  "allowExternalProviders" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "private_learning_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "private_learning_policies_companyId_key" ON "private_learning_policies"("companyId");
ALTER TABLE "private_learning_policies" ADD CONSTRAINT "private_learning_policies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
