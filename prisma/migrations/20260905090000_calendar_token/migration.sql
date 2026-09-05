-- Phase 5: a private calendar feed per person. The token is the whole credential — it
-- names the desk the feed shows — so it is minted on request, never shown twice by the
-- server without being asked, and rotating it kills every subscription made with the old one.
ALTER TABLE "User" ADD COLUMN "calendarToken" TEXT;
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");
