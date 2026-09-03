-- Tailored per-item reference material (Policy 005 source documentation, production refs):
-- links, reference photos/videos, documents — stored as [{label, url, kind}] on the item.
ALTER TABLE "ContentItem" ADD COLUMN "materialsJson" TEXT NOT NULL DEFAULT '[]';
