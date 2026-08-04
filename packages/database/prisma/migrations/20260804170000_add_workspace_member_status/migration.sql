CREATE TYPE "WorkspaceMemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

ALTER TABLE "WorkspaceMember"
  ADD COLUMN "status" "WorkspaceMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "suspendedAt" TIMESTAMP(3);

CREATE INDEX "WorkspaceMember_workspaceId_status_idx" ON "WorkspaceMember"("workspaceId", "status");
