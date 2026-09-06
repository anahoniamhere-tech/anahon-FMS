-- Postiz bridge (6 Sep 2026): the Postiz posts a content item releases when it passes the gate.
ALTER TABLE "ContentItem" ADD COLUMN "postizJson" TEXT NOT NULL DEFAULT '[]';
