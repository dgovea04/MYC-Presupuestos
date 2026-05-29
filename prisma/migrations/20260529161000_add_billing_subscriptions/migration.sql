CREATE TYPE "BillingMode" AS ENUM ('FREE', 'STRIPE', 'MANUAL');

CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'MANUAL');

CREATE TYPE "BillingSubscriptionStatus" AS ENUM (
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED'
);

ALTER TABLE "MembershipPlan"
ADD COLUMN "billingMode" "BillingMode" NOT NULL DEFAULT 'FREE',
ADD COLUMN "stripePriceId" TEXT,
ADD COLUMN "projectLimit" INTEGER,
ADD COLUMN "budgetLimit" INTEGER,
ADD COLUMN "entitlements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "MembershipPlan"
SET
  "billingMode" = 'FREE',
  "projectLimit" = 3,
  "budgetLimit" = 5,
  "entitlements" = ARRAY['exports.basic']::TEXT[]
WHERE "slug" = 'starter';

UPDATE "MembershipPlan"
SET
  "billingMode" = 'STRIPE',
  "projectLimit" = NULL,
  "budgetLimit" = NULL,
  "stripePriceId" = NULL,
  "entitlements" = ARRAY[
    'ai.local',
    'partidas.similarity',
    'work_schedule.intelligent',
    'polynomial_formula',
    'risk_analysis',
    'exports.advanced',
    'exports.basic'
  ]::TEXT[]
WHERE "slug" = 'pro';

UPDATE "MembershipPlan"
SET
  "billingMode" = 'MANUAL',
  "projectLimit" = NULL,
  "budgetLimit" = NULL,
  "entitlements" = ARRAY[
    'ai.local',
    'partidas.similarity',
    'work_schedule.intelligent',
    'polynomial_formula',
    'risk_analysis',
    'exports.advanced',
    'exports.basic'
  ]::TEXT[]
WHERE "slug" = 'empresa';

CREATE TABLE "BillingSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "status" "BillingSubscriptionStatus" NOT NULL,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "stripePriceId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "pastDueStartedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingWebhookEvent" (
  "id" TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL,
  CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingSubscription_stripeSubscriptionId_key" ON "BillingSubscription"("stripeSubscriptionId");
CREATE INDEX "BillingSubscription_userId_provider_idx" ON "BillingSubscription"("userId", "provider");
CREATE INDEX "BillingSubscription_stripeCustomerId_idx" ON "BillingSubscription"("stripeCustomerId");
CREATE INDEX "BillingSubscription_status_idx" ON "BillingSubscription"("status");
CREATE UNIQUE INDEX "BillingWebhookEvent_stripeEventId_key" ON "BillingWebhookEvent"("stripeEventId");
CREATE INDEX "BillingWebhookEvent_type_processedAt_idx" ON "BillingWebhookEvent"("type", "processedAt" DESC);
CREATE INDEX "MembershipPlan_billingMode_idx" ON "MembershipPlan"("billingMode");
CREATE INDEX "MembershipPlan_stripePriceId_idx" ON "MembershipPlan"("stripePriceId");

ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
