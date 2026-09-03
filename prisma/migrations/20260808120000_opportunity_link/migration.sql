-- Every opportunity carries the URL of the call it came from.
-- Intake already fetched that URL to read the call, but only kept the hostname in `notes`
-- as prose. Storing it as a field makes the application page one click away from the
-- pipeline card, and re-checkable when a deadline or eligibility rule changes.
ALTER TABLE "Opportunity" ADD COLUMN "link" TEXT NOT NULL DEFAULT '';
