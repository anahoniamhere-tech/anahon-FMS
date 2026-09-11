-- Editorial rehearsal (11 Sep 2026): one person walks the whole chain by standing in several seats.
-- Real pieces are untouched — they keep person-level separation, which is Policies 002 and 005.
-- `rehearsal` is written once, at creation, and no route may change it afterwards.
ALTER TABLE "ContentItem" ADD COLUMN "rehearsal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContentItem" ADD COLUMN "assigneeAs" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ContentItem" ADD COLUMN "factCheckerAs" TEXT NOT NULL DEFAULT '';
