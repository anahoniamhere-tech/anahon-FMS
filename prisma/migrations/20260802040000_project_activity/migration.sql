-- Project timeline: activities, milestones and reporting deadlines, each assignable
-- and dated, so a project's future actions are visible instead of remembered.
CREATE TABLE "ProjectActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'Activity',
    "dueDate" TEXT NOT NULL DEFAULT '',
    "assigneeUserId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "budgetLineId" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "completedOn" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL
);
CREATE INDEX "ProjectActivity_projectId_idx" ON "ProjectActivity"("projectId");
