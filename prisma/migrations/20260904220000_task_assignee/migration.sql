-- Phase 4: a task can be given to a person. Until now the statutory checklist had no
-- owner column at all, so every item was implicitly the Executive Director's. NULL
-- assigneeUserId keeps that meaning; a User id names the person whose turn it is.
-- createdBy records who put the task on the list.
ALTER TABLE "ComplianceTask" ADD COLUMN "assigneeUserId" TEXT;
ALTER TABLE "ComplianceTask" ADD COLUMN "createdBy" TEXT;
