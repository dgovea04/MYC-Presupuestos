ALTER TYPE "FindingStatus" RENAME TO "FindingStatus_old";
CREATE TYPE "FindingStatus" AS ENUM ('PENDING','IN_REVIEW','RESOLVED','REOPENED','STALE');
ALTER TABLE "ReviewFinding" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ReviewFinding" ALTER COLUMN "status" TYPE "FindingStatus" USING (CASE "status"::text WHEN 'OPEN' THEN 'PENDING' WHEN 'DISMISSED' THEN 'RESOLVED' ELSE "status"::text END)::"FindingStatus";
ALTER TABLE "ReviewFinding" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "FindingStatus_old";

ALTER TYPE "FindingResolution" RENAME TO "FindingResolution_old";
CREATE TYPE "FindingResolution" AS ENUM ('CONFIRMED_ISSUE','CORRECTED','VALID_AS_IS','FALSE_POSITIVE','NOT_APPLICABLE','NEEDS_MORE_INFORMATION');
ALTER TABLE "FindingDecision" ALTER COLUMN "resolution" TYPE "FindingResolution" USING (CASE "resolution"::text WHEN 'ACCEPTED' THEN 'VALID_AS_IS' WHEN 'REJECTED' THEN 'FALSE_POSITIVE' WHEN 'NEEDS_MORE_EVIDENCE' THEN 'NEEDS_MORE_INFORMATION' ELSE "resolution"::text END)::"FindingResolution";
DROP TYPE "FindingResolution_old";
