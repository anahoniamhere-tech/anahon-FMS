-- Project Officer role: users can be scoped to specific projects (requester-only).
ALTER TABLE "User" ADD COLUMN "projectIdsJson" TEXT NOT NULL DEFAULT '[]';
