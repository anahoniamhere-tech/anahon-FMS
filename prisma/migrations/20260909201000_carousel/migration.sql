-- Carousels (9 Sep 2026): a post may carry an ordered list of images rather than one.
-- Empty for every existing row, which keeps using imageUrl; src/meta.ts imagesOf() reads whichever
-- is set. Instagram takes 2..10 and fetches each itself, so every image needs a public HTTPS
-- address; Facebook accepts vault bytes.
ALTER TABLE "SocialPost" ADD COLUMN "imagesJson" TEXT NOT NULL DEFAULT '[]';
