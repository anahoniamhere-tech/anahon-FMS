-- Policy 002 "Content Types" (9 Sep 2026): News / Commercial / Opinion, which the policy requires
-- be clearly labelled on the published piece — and which the FMS could not record at all, so
-- sponsored content could not be marked as sponsored anywhere. Distinct from contentType, which
-- holds the FORMAT (Article, Reel, Podcast…). Empty until chosen; the publish gate refuses "".
ALTER TABLE "ContentItem" ADD COLUMN "contentLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ContentItem" ADD COLUMN "sponsorDisclosure" TEXT NOT NULL DEFAULT '';
