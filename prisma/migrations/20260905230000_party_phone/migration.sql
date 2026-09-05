-- A number a supplier or a freelancer can actually be reached on.
--
-- src/tabs/shared.ts can build a wa.me link, but only Client and NetworkContact carried a
-- phone, so two of the four messages had no data source. Vendor has a `contact` field and
-- it is not one: across the 34 live rows it holds "N/A" thirty-odd times, one email with a
-- postal address, and one phone number. Reading a number out of that means pattern-matching
-- free text, and waLink() exists precisely to refuse guesses — a wrong number opens a chat
-- with a stranger. So: a dedicated column, empty until someone fills it.
ALTER TABLE "Vendor" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Employee" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';

-- The one unambiguous case, carried over rather than retyped: a `contact` that is a whole
-- international number and nothing else. Deliberately strict — a leading +, then digits,
-- spaces and dashes only, at least eight digits. "N/A", the email-plus-address row, and
-- anything with a name attached are all left alone for a person to fill in. `contact` is
-- not modified; this only fills the new column.
UPDATE "Vendor" SET "phone" = REPLACE(REPLACE("contact", ' ', ''), '-', '')
WHERE "contact" GLOB '+[0-9]*'
  AND "contact" NOT GLOB '*[A-Za-z]*'
  AND "contact" NOT GLOB '*,*'
  AND LENGTH(REPLACE(REPLACE(REPLACE("contact", ' ', ''), '-', ''), '+', '')) >= 8;
