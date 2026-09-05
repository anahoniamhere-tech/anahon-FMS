-- When this person's employment began.
--
-- The yearly framework contract needs a period, and nothing on the record said when the
-- employment started, so the period was a guess every time one was drawn. Empty string,
-- not NULL, so it reads like every other date on this schema (YYYY-MM-DD, or "" for
-- not-yet-known) and no caller has to decide what a null date means.
ALTER TABLE "Employee" ADD COLUMN "startDate" TEXT NOT NULL DEFAULT '';
