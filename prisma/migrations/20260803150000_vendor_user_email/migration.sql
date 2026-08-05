-- Link a service provider to their login, so a voucher whose requester is its own payee
-- can be flagged for the approver. Mirrors Employee.userEmail.
ALTER TABLE "Vendor" ADD COLUMN "userEmail" TEXT NOT NULL DEFAULT '';
