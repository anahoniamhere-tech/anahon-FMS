-- Receiving equipment: what the item is, its sticker number, the voucher it was bought on,
-- who took delivery and who confirmed it physically. Additive only — on 11 Sep 2026 the
-- live register held no rows, so nothing is backfilled.
ALTER TABLE "FixedAsset" ADD COLUMN "tag" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "brand" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FixedAsset" ADD COLUMN "model" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FixedAsset" ADD COLUMN "specs" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FixedAsset" ADD COLUMN "expenseId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FixedAsset" ADD COLUMN "receivedAt" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "receivedBy" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "verifiedAt" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "verifiedBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_tag_key" ON "FixedAsset"("tag");
