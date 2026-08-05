-- Donor activity-timetable shape: results grouping, outline numbering, bilingual titles
-- and a start→end span (an activity runs across periods, it is not a single due date).
ALTER TABLE "ProjectActivity" ADD COLUMN "outlineNo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectActivity" ADD COLUMN "resultGroup" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectActivity" ADD COLUMN "titleAr" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectActivity" ADD COLUMN "startDate" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectActivity" ADD COLUMN "periodsJson" TEXT NOT NULL DEFAULT '[]';
