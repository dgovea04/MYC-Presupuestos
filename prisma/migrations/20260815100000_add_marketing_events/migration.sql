CREATE TABLE "marketing_events" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "userId" TEXT,
  "clientId" TEXT,
  "projectId" TEXT,
  "budgetId" TEXT,
  "eventVersion" TEXT NOT NULL DEFAULT '1',
  "pagePath" TEXT,
  "plan" TEXT,
  "isDemo" BOOLEAN,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "utmContent" TEXT,
  "firstTouchUtmSource" TEXT,
  "firstTouchUtmMedium" TEXT,
  "firstTouchUtmCampaign" TEXT,
  "firstTouchUtmContent" TEXT,
  "parameters" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "marketing_events"
ADD CONSTRAINT "marketing_events_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "marketing_events_name_occurredAt_idx" ON "marketing_events"("name", "occurredAt" DESC);
CREATE INDEX "marketing_events_userId_occurredAt_idx" ON "marketing_events"("userId", "occurredAt" DESC);
CREATE INDEX "marketing_events_clientId_occurredAt_idx" ON "marketing_events"("clientId", "occurredAt" DESC);
CREATE INDEX "marketing_events_utmSource_occurredAt_idx" ON "marketing_events"("utmSource", "occurredAt" DESC);
