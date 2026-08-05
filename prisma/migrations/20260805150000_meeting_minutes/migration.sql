-- Meeting minutes close the Policy 002 loop: the meeting documents topics, topics
-- become ideas, ideas become assignments. Minutes arrive by paste (any tool's
-- transcript) or in-app recording (audio → vault → Gemini transcription); the
-- extracted topics live on the meeting row — they are the meeting's documented
-- output, not register content.
ALTER TABLE "EditorialMeeting" ADD COLUMN "minutes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "EditorialMeeting" ADD COLUMN "topicsJson" TEXT NOT NULL DEFAULT '[]';
