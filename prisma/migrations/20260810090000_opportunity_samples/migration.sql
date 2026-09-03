-- Work samples attached to an application: [{url, title}].
-- Funders ask for published evidence, and the same pieces are reused across
-- applications. Stored as links rather than prose in `notes` so they stay clickable
-- and can be carried from one application to the next.
ALTER TABLE "Opportunity" ADD COLUMN "samplesJson" TEXT NOT NULL DEFAULT '[]';
