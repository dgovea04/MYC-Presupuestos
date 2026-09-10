ALTER TABLE "knowledge_price_observations" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "knowledge_yield_observations" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "knowledge_price_observations_idempotencyKey_key" ON "knowledge_price_observations"("idempotencyKey");
CREATE UNIQUE INDEX "knowledge_yield_observations_idempotencyKey_key" ON "knowledge_yield_observations"("idempotencyKey");
