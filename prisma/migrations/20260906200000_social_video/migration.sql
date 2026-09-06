-- Video on the Social desk (6 Sep 2026, evening): a vault video per post, a Reel flag for Facebook,
-- and the Instagram container the queue watches while Instagram transcodes.
ALTER TABLE "SocialPost" ADD COLUMN "videoRef" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SocialPost" ADD COLUMN "asReel" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SocialPost" ADD COLUMN "containerId" TEXT NOT NULL DEFAULT '';
