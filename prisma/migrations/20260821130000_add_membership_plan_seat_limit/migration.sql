ALTER TABLE "MembershipPlan" ADD COLUMN "seatLimit" INTEGER;

UPDATE "MembershipPlan" SET "seatLimit" = 3 WHERE "slug" = 'starter';
UPDATE "MembershipPlan" SET "seatLimit" = 10 WHERE "slug" = 'pro';
UPDATE "MembershipPlan" SET "seatLimit" = NULL WHERE "slug" = 'empresa';
