-- Scope a Project Officer to a whole programme, not a hand-picked project list, so
-- new projects in that programme are included automatically.
ALTER TABLE "User" ADD COLUMN "streamScope" TEXT NOT NULL DEFAULT '';
