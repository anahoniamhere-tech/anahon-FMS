-- Donor terms a grant agreement requires in every contract made under it (SKF §2.13 sanctions,
-- §2.03 f termination-if-the-donor-terminates). Per project, because they are the donor's words
-- for that grant and no two grants impose the same ones; both languages, because the contract is
-- bilingual and the Arabic governs. Empty on every existing project: no grant's terms are invented.
ALTER TABLE "Project" ADD COLUMN "donorClausesEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Project" ADD COLUMN "donorClausesAr" TEXT NOT NULL DEFAULT '';
