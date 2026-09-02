-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReviewRunStatus" AS ENUM ('DRAFT','QUEUED','RUNNING','COMPLETED','COMPLETED_WITH_WARNINGS','FAILED','CANCELLED','STALE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ReviewFindingType" AS ENUM ('QUANTITY_MISMATCH','UNIT_INCONSISTENCY','TECHNICAL_SPEC_MISMATCH','MISSING_DOCUMENTATION','INCOMPLETE_APU');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "FindingStatus" AS ENUM ('OPEN','IN_REVIEW','RESOLVED','DISMISSED','STALE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "FindingResolution" AS ENUM ('ACCEPTED','REJECTED','NOT_APPLICABLE','NEEDS_MORE_EVIDENCE','CORRECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED','PROCESSING','READY','COMPLETED_WITH_WARNINGS','FAILED','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "EvidenceType" AS ENUM ('QUANTITY','UNIT','TECHNICAL_SPECIFICATION','DOCUMENT_REFERENCE','APU_COMPONENT','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW','MEDIUM','HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ReviewDocumentCategory" AS ENUM ('PLAN','TECHNICAL_SPECIFICATION','QUANTITY_TAKEOFF','BUDGET','APU','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING','PROCESSING','COMPLETED','COMPLETED_WITH_WARNINGS','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "EntityLinkValidationStatus" AS ENUM ('PENDING','CONFIRMED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Required by tenant-aware composite foreign keys.
DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_id_companyId_key" UNIQUE ("id", "companyId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE "ProjectDocument" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "category" "ReviewDocumentCategory" NOT NULL DEFAULT 'OTHER',
  "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "currentVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectDocument_id_companyId_projectId_key" UNIQUE ("id", "companyId", "projectId"),
  CONSTRAINT "ProjectDocument_currentVersionId_companyId_projectId_key" UNIQUE ("currentVersionId", "companyId", "projectId"),
  CONSTRAINT "ProjectDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectDocument_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "Project"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProjectDocument_companyId_projectId_status_idx" ON "ProjectDocument"("companyId", "projectId", "status");
CREATE INDEX "ProjectDocument_projectId_createdAt_idx" ON "ProjectDocument"("projectId", "createdAt" DESC);
CREATE INDEX "ProjectDocument_createdById_idx" ON "ProjectDocument"("createdById");

CREATE TABLE "DocumentVersion" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "projectDocumentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "pageCount" INTEGER,
  "sheetCount" INTEGER,
  "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
  "extractionWarnings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentVersion_projectDocumentId_versionNumber_key" UNIQUE ("projectDocumentId", "versionNumber"),
  CONSTRAINT "DocumentVersion_projectDocumentId_sha256_key" UNIQUE ("projectDocumentId", "sha256"),
  CONSTRAINT "DocumentVersion_id_companyId_projectId_key" UNIQUE ("id", "companyId", "projectId"),
  CONSTRAINT "DocumentVersion_projectDocumentId_companyId_projectId_fkey" FOREIGN KEY ("projectDocumentId", "companyId", "projectId") REFERENCES "ProjectDocument"("id", "companyId", "projectId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DocumentVersion_projectDocumentId_createdAt_idx" ON "DocumentVersion"("projectDocumentId", "createdAt" DESC);
CREATE INDEX "DocumentVersion_sha256_idx" ON "DocumentVersion"("sha256");
CREATE INDEX "DocumentVersion_extractionStatus_idx" ON "DocumentVersion"("extractionStatus");
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_currentVersionId_companyId_projectId_fkey" FOREIGN KEY ("currentVersionId", "companyId", "projectId") REFERENCES "DocumentVersion"("id", "companyId", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ReviewEvidence" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "documentVersionId" TEXT NOT NULL,
  "evidenceType" "EvidenceType" NOT NULL,
  "originalText" TEXT NOT NULL,
  "normalizedText" TEXT,
  "locationJson" JSONB NOT NULL,
  "value" DECIMAL(18,6),
  "unit" TEXT,
  "extractionMethod" TEXT NOT NULL,
  "confidence" "ConfidenceLevel" NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewEvidence_documentVersionId_sourceHash_key" UNIQUE ("documentVersionId", "sourceHash"),
  CONSTRAINT "ReviewEvidence_id_companyId_projectId_key" UNIQUE ("id", "companyId", "projectId"),
  CONSTRAINT "ReviewEvidence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewEvidence_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "Project"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewEvidence_documentVersionId_companyId_projectId_fkey" FOREIGN KEY ("documentVersionId", "companyId", "projectId") REFERENCES "DocumentVersion"("id", "companyId", "projectId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReviewEvidence_companyId_projectId_evidenceType_idx" ON "ReviewEvidence"("companyId", "projectId", "evidenceType");
CREATE INDEX "ReviewEvidence_documentVersionId_createdAt_idx" ON "ReviewEvidence"("documentVersionId", "createdAt" DESC);
CREATE INDEX "ReviewEvidence_confidence_idx" ON "ReviewEvidence"("confidence");

CREATE TABLE "ReviewRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "budgetId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "configurationJson" JSONB NOT NULL,
  "rulesVersion" TEXT NOT NULL,
  "status" "ReviewRunStatus" NOT NULL DEFAULT 'DRAFT',
  "progressJson" JSONB,
  "warningsJson" JSONB,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewRun_id_companyId_projectId_key" UNIQUE ("id", "companyId", "projectId"),
  CONSTRAINT "ReviewRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewRun_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "Project"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewRun_budgetId_projectId_fkey" FOREIGN KEY ("budgetId", "projectId") REFERENCES "Budget"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReviewRun_companyId_projectId_status_idx" ON "ReviewRun"("companyId", "projectId", "status");
CREATE INDEX "ReviewRun_budgetId_createdAt_idx" ON "ReviewRun"("budgetId", "createdAt" DESC);
CREATE INDEX "ReviewRun_createdById_idx" ON "ReviewRun"("createdById");

CREATE TABLE "ReviewRunDocumentVersion" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "reviewRunId" TEXT NOT NULL,
  "documentVersionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewRunDocumentVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewRunDocumentVersion_reviewRunId_documentVersionId_key" UNIQUE ("reviewRunId", "documentVersionId"),
  CONSTRAINT "ReviewRunDocumentVersion_reviewRunId_companyId_projectId_fkey" FOREIGN KEY ("reviewRunId", "companyId", "projectId") REFERENCES "ReviewRun"("id", "companyId", "projectId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewRunDocumentVersion_documentVersionId_companyId_projectId_fkey" FOREIGN KEY ("documentVersionId", "companyId", "projectId") REFERENCES "DocumentVersion"("id", "companyId", "projectId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReviewRunDocumentVersion_companyId_projectId_reviewRunId_idx" ON "ReviewRunDocumentVersion"("companyId", "projectId", "reviewRunId");
CREATE INDEX "ReviewRunDocumentVersion_documentVersionId_idx" ON "ReviewRunDocumentVersion"("documentVersionId");

CREATE TABLE "EntityLink" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "budgetId" TEXT NOT NULL,
  "budgetItemId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "signalsJson" JSONB NOT NULL,
  "score" DECIMAL(8,6) NOT NULL,
  "confidence" "ConfidenceLevel" NOT NULL,
  "validationStatus" "EntityLinkValidationStatus" NOT NULL DEFAULT 'PENDING',
  "validatedById" TEXT,
  "validatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EntityLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EntityLink_budgetItemId_evidenceId_key" UNIQUE ("budgetItemId", "evidenceId"),
  CONSTRAINT "EntityLink_id_companyId_projectId_key" UNIQUE ("id", "companyId", "projectId"),
  CONSTRAINT "EntityLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EntityLink_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "Project"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EntityLink_budgetId_projectId_fkey" FOREIGN KEY ("budgetId", "projectId") REFERENCES "Budget"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EntityLink_budgetItemId_budgetId_fkey" FOREIGN KEY ("budgetItemId", "budgetId") REFERENCES "BudgetItem"("id", "budgetId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EntityLink_evidenceId_companyId_projectId_fkey" FOREIGN KEY ("evidenceId", "companyId", "projectId") REFERENCES "ReviewEvidence"("id", "companyId", "projectId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EntityLink_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "EntityLink_companyId_projectId_validationStatus_idx" ON "EntityLink"("companyId", "projectId", "validationStatus");
CREATE INDEX "EntityLink_budgetId_budgetItemId_idx" ON "EntityLink"("budgetId", "budgetItemId");
CREATE INDEX "EntityLink_evidenceId_idx" ON "EntityLink"("evidenceId");

CREATE TABLE "ReviewFinding" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "budgetId" TEXT NOT NULL,
  "reviewRunId" TEXT NOT NULL,
  "budgetItemId" TEXT,
  "budgetItemBudgetId" TEXT,
  "entityLinkId" TEXT,
  "evidenceId" TEXT NOT NULL,
  "findingType" "ReviewFindingType" NOT NULL,
  "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
  "severity" TEXT NOT NULL,
  "priority" DECIMAL(8,6) NOT NULL,
  "confidence" "ConfidenceLevel" NOT NULL,
  "score" DECIMAL(8,6) NOT NULL,
  "potentialImpact" DECIMAL(18,6),
  "ruleKey" TEXT NOT NULL,
  "comparisonJson" JSONB NOT NULL,
  "humanReviewRequired" BOOLEAN NOT NULL DEFAULT true,
  "automaticBudgetMutation" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewFinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewFinding_id_companyId_projectId_key" UNIQUE ("id", "companyId", "projectId"),
  CONSTRAINT "ReviewFinding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewFinding_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "Project"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewFinding_budgetId_projectId_fkey" FOREIGN KEY ("budgetId", "projectId") REFERENCES "Budget"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewFinding_reviewRunId_companyId_projectId_fkey" FOREIGN KEY ("reviewRunId", "companyId", "projectId") REFERENCES "ReviewRun"("id", "companyId", "projectId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewFinding_budgetItemId_budgetItemBudgetId_fkey" FOREIGN KEY ("budgetItemId", "budgetItemBudgetId") REFERENCES "BudgetItem"("id", "budgetId") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ReviewFinding_entityLinkId_companyId_projectId_fkey" FOREIGN KEY ("entityLinkId", "companyId", "projectId") REFERENCES "EntityLink"("id", "companyId", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReviewFinding_evidenceId_companyId_projectId_fkey" FOREIGN KEY ("evidenceId", "companyId", "projectId") REFERENCES "ReviewEvidence"("id", "companyId", "projectId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReviewFinding_companyId_projectId_status_idx" ON "ReviewFinding"("companyId", "projectId", "status");
CREATE INDEX "ReviewFinding_reviewRunId_findingType_priority_idx" ON "ReviewFinding"("reviewRunId", "findingType", "priority");
CREATE INDEX "ReviewFinding_budgetId_budgetItemId_idx" ON "ReviewFinding"("budgetId", "budgetItemId");
CREATE INDEX "ReviewFinding_evidenceId_idx" ON "ReviewFinding"("evidenceId");
CREATE INDEX "ReviewFinding_entityLinkId_idx" ON "ReviewFinding"("entityLinkId");

CREATE TABLE "FindingDecision" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resolution" "FindingResolution" NOT NULL,
  "note" TEXT,
  "expectedUpdatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FindingDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FindingDecision_findingId_companyId_projectId_fkey" FOREIGN KEY ("findingId", "companyId", "projectId") REFERENCES "ReviewFinding"("id", "companyId", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FindingDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FindingDecision_findingId_createdAt_idx" ON "FindingDecision"("findingId", "createdAt" DESC);
CREATE INDEX "FindingDecision_userId_createdAt_idx" ON "FindingDecision"("userId", "createdAt" DESC);

CREATE TABLE "ReviewAuditEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "reviewRunId" TEXT,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "correlationId" TEXT,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewAuditEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewAuditEvent_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "Project"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewAuditEvent_reviewRunId_companyId_projectId_fkey" FOREIGN KEY ("reviewRunId", "companyId", "projectId") REFERENCES "ReviewRun"("id", "companyId", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReviewAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ReviewAuditEvent_companyId_projectId_createdAt_idx" ON "ReviewAuditEvent"("companyId", "projectId", "createdAt" DESC);
CREATE INDEX "ReviewAuditEvent_reviewRunId_createdAt_idx" ON "ReviewAuditEvent"("reviewRunId", "createdAt" DESC);
CREATE INDEX "ReviewAuditEvent_actorUserId_idx" ON "ReviewAuditEvent"("actorUserId");
CREATE INDEX "ReviewAuditEvent_correlationId_idx" ON "ReviewAuditEvent"("correlationId");
