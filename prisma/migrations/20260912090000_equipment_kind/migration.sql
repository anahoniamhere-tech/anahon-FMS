-- Equipment kind, for Finance's useful-life policy table (src/equipment.ts). Additive; every
-- existing item is untyped until someone opens its card, and the read side treats a blank
-- kind exactly like an unrecognised one — both fall back to "other".
ALTER TABLE "FixedAsset" ADD COLUMN "kind" TEXT NOT NULL DEFAULT '';
