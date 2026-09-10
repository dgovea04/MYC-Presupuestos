CREATE TABLE "knowledge_assertion_conflicts" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "assertionId" TEXT NOT NULL,
  "conflictingAssertionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reason" TEXT NOT NULL,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_assertion_conflicts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_assertion_conflicts_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "knowledge_assertion_conflicts_assertionId_conflictingAssertionId_key" UNIQUE ("assertionId", "conflictingAssertionId"),
  CONSTRAINT "knowledge_assertion_conflicts_assertionId_fkey" FOREIGN KEY ("assertionId") REFERENCES "knowledge_assertions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "knowledge_assertion_conflicts_conflictingAssertionId_fkey" FOREIGN KEY ("conflictingAssertionId") REFERENCES "knowledge_assertions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "knowledge_assertion_conflicts_status_createdAt_idx" ON "knowledge_assertion_conflicts"("status", "createdAt" DESC);
CREATE INDEX "knowledge_assertion_conflicts_assertionId_status_idx" ON "knowledge_assertion_conflicts"("assertionId", "status");
