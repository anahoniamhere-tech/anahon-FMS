-- Equipment phase 2: who has an item and until when, when it is next due a physical check,
-- and its own log of movements and repairs. Additive. Any item already confirmed gets its
-- next check twelve months after that confirmation, the default every new one receives.
ALTER TABLE "FixedAsset" ADD COLUMN "holderId" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "heldFor" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FixedAsset" ADD COLUMN "heldProjectId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FixedAsset" ADD COLUMN "outAt" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "dueBack" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "nextCheckDue" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "movementsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "FixedAsset" ADD COLUMN "repairsJson" TEXT NOT NULL DEFAULT '[]';
UPDATE "FixedAsset" SET "nextCheckDue" = date("verifiedAt", '+12 months') WHERE "verifiedAt" IS NOT NULL;
