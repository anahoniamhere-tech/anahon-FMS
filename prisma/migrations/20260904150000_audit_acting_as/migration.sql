-- Role assumption: when a Super Admin acts in a seat that is not their own, the log
-- records which seat, so the record shows one person wearing two hats rather than
-- implying two people. NULL means the person acted as themselves.
ALTER TABLE "AuditLog" ADD COLUMN "actingAs" TEXT;
