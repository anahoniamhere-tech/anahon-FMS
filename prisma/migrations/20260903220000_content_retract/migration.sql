-- Retraction: the piece leaves the website; the published record stays with the reason and date.
ALTER TABLE ContentItem ADD COLUMN retractedAt   TEXT NOT NULL DEFAULT '';
ALTER TABLE ContentItem ADD COLUMN retractReason TEXT NOT NULL DEFAULT '';
