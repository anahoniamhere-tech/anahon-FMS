-- Cover image for a content item: a file in the vault (GENERAL/Cover/), generated or uploaded.
ALTER TABLE ContentItem ADD COLUMN coverPath     TEXT NOT NULL DEFAULT '';
ALTER TABLE ContentItem ADD COLUMN coverProvider TEXT NOT NULL DEFAULT '';
