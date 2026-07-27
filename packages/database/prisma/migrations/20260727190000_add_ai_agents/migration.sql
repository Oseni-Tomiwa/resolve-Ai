CREATE TYPE "AIAgentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');

CREATE TABLE "AIAgent" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT NOT NULL,
    "greeting" TEXT,
    "fallbackMessage" TEXT,
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 800,
    "status" "AIAgentStatus" NOT NULL DEFAULT 'DRAFT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AIAgent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AIConversation" ADD COLUMN "agentId" UUID;
ALTER TABLE "AIMessage" ADD COLUMN "agentId" UUID;
ALTER TABLE "AIMessage" ADD COLUMN "agentNameSnapshot" TEXT;

CREATE UNIQUE INDEX "AIAgent_workspaceId_slug_key" ON "AIAgent"("workspaceId", "slug");
CREATE UNIQUE INDEX "AIAgent_id_workspaceId_key" ON "AIAgent"("id", "workspaceId");
CREATE INDEX "AIAgent_workspaceId_status_idx" ON "AIAgent"("workspaceId", "status");
CREATE INDEX "AIAgent_workspaceId_isDefault_idx" ON "AIAgent"("workspaceId", "isDefault");
CREATE INDEX "AIAgent_workspaceId_deletedAt_idx" ON "AIAgent"("workspaceId", "deletedAt");
CREATE UNIQUE INDEX "AIAgent_workspaceId_default_key" ON "AIAgent"("workspaceId") WHERE "isDefault" = true AND "deletedAt" IS NULL;

ALTER TABLE "AIAgent" ADD CONSTRAINT "AIAgent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIAgent" ADD CONSTRAINT "AIAgent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_agentId_workspaceId_fkey" FOREIGN KEY ("agentId", "workspaceId") REFERENCES "AIAgent"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
