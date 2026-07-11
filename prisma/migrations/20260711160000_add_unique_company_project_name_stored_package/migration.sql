-- Add unique constraint to prevent duplicate packages per company+name
-- This enforces the upsert-by-name behavior in application code
CREATE UNIQUE INDEX "stored_project_packages_companyId_projectName_key"
  ON "stored_project_packages" ("companyId", "projectName");
