-- The freelancer pool: people AnaHon may engage but has no contract with yet.
--
-- Not NetworkContact: the Contacts door is open to every full-view seat PLUS the Procurement
-- and Logistics Officer and the Digital Officer, and its rows reach them whole — a prospect's
-- contact details and day rate would travel with it. Bolting personnel-file privacy onto a
-- record built to be shared means a second visibility rule on one table.
--
-- Not Vendor (engageable): a Vendor is a party we PAY. It appears in the Suppliers door and in
-- voucher payee lists, and "turn a pool entry into a supplier" is Buying & paying's own flow —
-- a pool entry is by definition not a supplier yet. Putting prospects there would make that
-- handover meaningless and put unvetted people into payee pickers.
--
-- CVs stay in AppDoc under PERSONNEL/Freelancer Pool/<name>, category CV, and link here by
-- partyId = PoolCandidate.id. No employee matches a pool id, so maySeePersonnelFile lets only
-- the personnel-file roles see them — in state, on the byte route and on upload alike.
CREATE TABLE "PoolCandidate" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "name"       TEXT NOT NULL,
    "skills"     TEXT NOT NULL DEFAULT '',
    "city"       TEXT NOT NULL DEFAULT '',
    "country"    TEXT NOT NULL DEFAULT '',
    "languages"  TEXT NOT NULL DEFAULT '',
    "email"      TEXT NOT NULL DEFAULT '',
    "phone"      TEXT NOT NULL DEFAULT '',
    "dayRate"    REAL,
    "currency"   TEXT NOT NULL DEFAULT 'USD',
    "status"     TEXT NOT NULL DEFAULT 'Prospect',
    "notes"      TEXT NOT NULL DEFAULT '',
    "createdBy"  TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL
);
CREATE INDEX "PoolCandidate_status_idx" ON "PoolCandidate"("status");
