-- When someone last confirmed the subscription is still live. A status can go stale
-- silently; a dated confirmation cannot.
ALTER TABLE "Subscription" ADD COLUMN "verifiedOn" TEXT NOT NULL DEFAULT '';
