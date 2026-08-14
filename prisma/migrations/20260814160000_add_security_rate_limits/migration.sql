CREATE TABLE "security_rate_limit_buckets" (
  "id" TEXT NOT NULL,
  "bucketKey" TEXT NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "security_rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "security_rate_limit_buckets_bucketKey_key"
  ON "security_rate_limit_buckets"("bucketKey");
CREATE INDEX "security_rate_limit_buckets_windowStartedAt_idx"
  ON "security_rate_limit_buckets"("windowStartedAt");
