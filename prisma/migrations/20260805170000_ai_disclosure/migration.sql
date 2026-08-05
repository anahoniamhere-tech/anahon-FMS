-- The golden transparency rule (Saad, 5 Aug 2026; Policy 002 Transparency): content
-- produced with AI help must say so — watermark on visuals, disclaimer at the end of
-- articles. aiAssisted is set automatically when an AI draft is saved to the item;
-- publish is blocked until aiDisclosed attests the label is on the published piece.
ALTER TABLE "ContentItem" ADD COLUMN "aiAssisted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContentItem" ADD COLUMN "aiDisclosed" BOOLEAN NOT NULL DEFAULT false;
