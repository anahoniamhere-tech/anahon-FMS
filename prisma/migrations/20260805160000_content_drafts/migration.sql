-- Production drafts live on the content item: what the reporter writes with the
-- studio is what the fact-checker verifies and the editors approve. [{label, kind,
-- text, date, by}] — multiple drafts per item (article draft, script, carousel, caption).
ALTER TABLE "ContentItem" ADD COLUMN "draftsJson" TEXT NOT NULL DEFAULT '[]';
