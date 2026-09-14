-- The freelancer pool, split by field (Saad, 14 Sep 2026).
--
-- Each field is assessed by the head whose terms of reference cover it — Editorial by the Chief
-- Editor, Production by the Production Manager — and a person may be in both. So status and
-- assessment move off the person and onto (person, field): one row per field they are in.
-- Membership of a field IS having a row for it, which is also what makes redaction a filter:
-- a head is sent only their field's rows, and the other field cannot leak through a column
-- somebody forgot to strip.
CREATE TABLE "PoolAssessment" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "field"       TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'Prospect',
    "rating"      INTEGER,
    "note"        TEXT NOT NULL DEFAULT '',
    "assessedBy"  TEXT NOT NULL DEFAULT '',
    "assessedAs"  TEXT NOT NULL DEFAULT '',
    "assessedAt"  TEXT NOT NULL DEFAULT '',
    "created_at"  TEXT NOT NULL
);
CREATE UNIQUE INDEX "PoolAssessment_candidateId_field_key" ON "PoolAssessment"("candidateId", "field");
CREATE INDEX "PoolAssessment_field_idx" ON "PoolAssessment"("field");

-- The single, field-less status is gone. Its one live value (Rasha Kayali, "Prospect") is carried
-- into her Production assessment by the seed that follows this migration, not guessed here: a
-- migration cannot know which field an arbitrary row belongs to.
DROP INDEX "PoolCandidate_status_idx";
ALTER TABLE "PoolCandidate" DROP COLUMN "status";
