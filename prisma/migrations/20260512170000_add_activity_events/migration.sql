CREATE TYPE "ActivityEventType" AS ENUM (
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'BUDGET_CREATED',
  'BUDGET_UPDATED',
  'POLYNOMIAL_FORMULA_GENERATED',
  'POLYNOMIAL_FORMULA_UPDATED',
  'ADJUSTMENT_REGISTERED'
);

CREATE TABLE "ActivityEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ActivityEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ActivityEvent"
ADD CONSTRAINT "ActivityEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ActivityEvent_userId_createdAt_idx" ON "ActivityEvent"("userId", "createdAt" DESC);
CREATE INDEX "ActivityEvent_type_createdAt_idx" ON "ActivityEvent"("type", "createdAt" DESC);
