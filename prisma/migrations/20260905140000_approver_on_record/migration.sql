-- Phase 7: the approver on the record, not only in the log.
--
-- Until now a voucher carried the moment it was signed but not who signed it: the name
-- survived in the audit trail and in a comment's author, and a timesheet's approvedBy
-- held a display name, a user id or nothing depending on which route wrote it. A donor's
-- auditor asking "who approved this" had to be handed a story. Each step now writes the
-- account that took it and the seat that account was wearing at the time — a Super Admin
-- standing in for a vacant Program Director is recorded as exactly that, one person in
-- two hats rather than two people.
ALTER TABLE "Expense" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Expense" ADD COLUMN "approvedAs"   TEXT;
ALTER TABLE "Expense" ADD COLUMN "paidById"     TEXT;
ALTER TABLE "Expense" ADD COLUMN "paidAs"       TEXT;
ALTER TABLE "Expense" ADD COLUMN "postedById"   TEXT;
ALTER TABLE "Expense" ADD COLUMN "postedAs"     TEXT;
ALTER TABLE "Procurement" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Procurement" ADD COLUMN "approvedAs"   TEXT;
ALTER TABLE "Timesheet" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Timesheet" ADD COLUMN "approvedAs"   TEXT;
ALTER TABLE "ContentItem" ADD COLUMN "pmApprovedAs" TEXT;
ALTER TABLE "ContentItem" ADD COLUMN "pdApprovedAs" TEXT;
