-- Solidarity with journalists and outlets at risk (P3 §7.5, Editorial Standards Ed. 7).
-- The events register gains the two fields that make the policy's actions countable, and the
-- contacts register gains the three press-freedom organisations §7.5 names — websites only,
-- no person, no email, no phone. Fixed ids and INSERT OR IGNORE, so re-running changes nothing.
ALTER TABLE "Engagement" ADD COLUMN "solidarityAction" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Engagement" ADD COLUMN "hours" REAL NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO "NetworkContact"
  ("id","name","nameAr","org","role","country","email","phone","links","kind","metAt","engagementId","metOn","stream","followUp","followUpBy","status","notes","created_at")
VALUES
  ('ct-pf-cpj','Committee to Protect Journalists','لجنة حماية الصحفيين','Committee to Protect Journalists','','International','','','https://cpj.org','Press-freedom','','',' ','','','','New','Press-freedom organisation (P3 §7.5). Organisation record only — no personal data.',datetime('now')),
  ('ct-pf-rsf','Reporters Without Borders','مراسلون بلا حدود','Reporters Without Borders (RSF)','','International','','','https://rsf.org','Press-freedom','','',' ','','','','New','Press-freedom organisation (P3 §7.5). Organisation record only — no personal data.',datetime('now')),
  ('ct-pf-skeyes','SKeyes Center for Media and Cultural Freedom','مركز سكايز للحريات الإعلامية والثقافية','Samir Kassir Foundation — SKeyes','','Lebanon','','','https://skeyesmedia.org','Press-freedom','','',' ','','','','New','Press-freedom organisation (P3 §7.5). Organisation record only — no personal data.',datetime('now'));
