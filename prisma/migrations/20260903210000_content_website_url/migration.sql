-- The website's URL for a published item, written back by the publish hook (notifySite).
ALTER TABLE ContentItem ADD COLUMN websiteUrl TEXT NOT NULL DEFAULT '';
