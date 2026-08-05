-- Content hash makes duplicate uploads impossible (same bytes = same document, the
-- upload returns the existing row instead of filing a second copy) and lets the
-- materials library collapse duplicates already on disk. note carries the editable
-- description shown in the library.
ALTER TABLE "AppDoc" ADD COLUMN "contentHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppDoc" ADD COLUMN "note" TEXT NOT NULL DEFAULT '';
