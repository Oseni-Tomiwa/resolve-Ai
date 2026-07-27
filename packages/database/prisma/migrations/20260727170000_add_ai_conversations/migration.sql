-- Persistent workspace-scoped AI conversations and grounded message citations.
CREATE TYPE "AIConversationStatus" AS ENUM ('ACTIVE');
CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE "AIMessageStatus" AS ENUM ('PENDING', 'STREAMING', 'COMPLETE', 'FAILED', 'CANCELLED');

CREATE TABLE "AIConversation" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "status" "AIConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generationLockAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "AIMessageStatus" NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIMessageSource" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "chunkId" UUID NOT NULL,
    "sourceNumber" INTEGER NOT NULL,
    "documentNameSnapshot" TEXT NOT NULL,
    "chunkIndexSnapshot" INTEGER NOT NULL,
    "contentPreview" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "cited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIMessageSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIConversation_id_workspaceId_key" ON "AIConversation"("id", "workspaceId");
CREATE UNIQUE INDEX "KnowledgeDocument_id_workspaceId_key" ON "KnowledgeDocument"("id", "workspaceId");
CREATE UNIQUE INDEX "KnowledgeChunk_id_workspaceId_key" ON "KnowledgeChunk"("id", "workspaceId");
CREATE INDEX "AIConversation_workspaceId_lastMessageAt_idx" ON "AIConversation"("workspaceId", "lastMessageAt");
CREATE INDEX "AIConversation_workspaceId_createdAt_idx" ON "AIConversation"("workspaceId", "createdAt");
CREATE INDEX "AIConversation_workspaceId_deletedAt_idx" ON "AIConversation"("workspaceId", "deletedAt");
CREATE UNIQUE INDEX "AIMessage_id_workspaceId_key" ON "AIMessage"("id", "workspaceId");
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");
CREATE INDEX "AIMessage_workspaceId_createdAt_idx" ON "AIMessage"("workspaceId", "createdAt");
CREATE UNIQUE INDEX "AIMessageSource_messageId_sourceNumber_key" ON "AIMessageSource"("messageId", "sourceNumber");
CREATE INDEX "AIMessageSource_workspaceId_createdAt_idx" ON "AIMessageSource"("workspaceId", "createdAt");

ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_workspaceId_fkey" FOREIGN KEY ("conversationId", "workspaceId") REFERENCES "AIConversation"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIMessageSource" ADD CONSTRAINT "AIMessageSource_messageId_workspaceId_fkey" FOREIGN KEY ("messageId", "workspaceId") REFERENCES "AIMessage"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIMessageSource" ADD CONSTRAINT "AIMessageSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIMessageSource" ADD CONSTRAINT "AIMessageSource_documentId_workspaceId_fkey" FOREIGN KEY ("documentId", "workspaceId") REFERENCES "KnowledgeDocument"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIMessageSource" ADD CONSTRAINT "AIMessageSource_chunkId_workspaceId_fkey" FOREIGN KEY ("chunkId", "workspaceId") REFERENCES "KnowledgeChunk"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
