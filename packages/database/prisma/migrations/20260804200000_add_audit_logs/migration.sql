CREATE TABLE "AuditLog" ("id" UUID NOT NULL, "organizationId" UUID NOT NULL, "workspaceId" UUID, "actorUserId" UUID, "actorMembershipId" UUID, "action" TEXT NOT NULL, "targetType" TEXT NOT NULL, "targetId" TEXT, "metadata" JSONB, "requestId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AuditLog_workspaceId_createdAt_id_idx" ON "AuditLog"("workspaceId", "createdAt", "id");
CREATE INDEX "AuditLog_organizationId_action_createdAt_idx" ON "AuditLog"("organizationId", "action", "createdAt");
CREATE INDEX "AuditLog_workspaceId_actorUserId_createdAt_idx" ON "AuditLog"("workspaceId", "actorUserId", "createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
