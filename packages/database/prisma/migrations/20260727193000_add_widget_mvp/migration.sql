CREATE TYPE "WidgetPosition" AS ENUM ('BOTTOM_LEFT', 'BOTTOM_RIGHT');

CREATE TABLE "WidgetConfiguration" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "publicId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "name" TEXT NOT NULL DEFAULT 'ResolveAI Support',
  "selectedAgentId" UUID NOT NULL,
  "greeting" TEXT NOT NULL DEFAULT 'Hi! How can I help you today?',
  "accentColor" TEXT NOT NULL DEFAULT '#7ce7dc',
  "position" "WidgetPosition" NOT NULL DEFAULT 'BOTTOM_RIGHT',
  "launcherLabel" TEXT NOT NULL DEFAULT 'Chat with us',
  "allowedDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WidgetConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WidgetConfiguration_workspaceId_key" ON "WidgetConfiguration"("workspaceId");
CREATE UNIQUE INDEX "WidgetConfiguration_publicId_key" ON "WidgetConfiguration"("publicId");
CREATE INDEX "WidgetConfiguration_workspaceId_enabled_idx" ON "WidgetConfiguration"("workspaceId", "enabled");
ALTER TABLE "WidgetConfiguration" ADD CONSTRAINT "WidgetConfiguration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WidgetConfiguration" ADD CONSTRAINT "WidgetConfiguration_selectedAgentId_workspaceId_fkey" FOREIGN KEY ("selectedAgentId", "workspaceId") REFERENCES "AIAgent"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WidgetSession" (
  "id" UUID NOT NULL,
  "widgetConfigurationId" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "pageUrl" TEXT,
  "referrer" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WidgetSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WidgetSession_tokenHash_key" ON "WidgetSession"("tokenHash");
CREATE INDEX "WidgetSession_widgetConfigurationId_expiresAt_idx" ON "WidgetSession"("widgetConfigurationId", "expiresAt");
CREATE INDEX "WidgetSession_workspaceId_expiresAt_idx" ON "WidgetSession"("workspaceId", "expiresAt");
ALTER TABLE "WidgetSession" ADD CONSTRAINT "WidgetSession_widgetConfigurationId_fkey" FOREIGN KEY ("widgetConfigurationId") REFERENCES "WidgetConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WidgetSession" ADD CONSTRAINT "WidgetSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WidgetConversation" (
  "id" UUID NOT NULL,
  "widgetConfigurationId" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "agentId" UUID NOT NULL,
  "agentNameSnapshot" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'New visitor conversation',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WidgetConversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WidgetConversation_id_workspaceId_key" ON "WidgetConversation"("id", "workspaceId");
CREATE INDEX "WidgetConversation_workspaceId_createdAt_idx" ON "WidgetConversation"("workspaceId", "createdAt");
CREATE INDEX "WidgetConversation_sessionId_createdAt_idx" ON "WidgetConversation"("sessionId", "createdAt");
ALTER TABLE "WidgetConversation" ADD CONSTRAINT "WidgetConversation_widgetConfigurationId_fkey" FOREIGN KEY ("widgetConfigurationId") REFERENCES "WidgetConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WidgetConversation" ADD CONSTRAINT "WidgetConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WidgetConversation" ADD CONSTRAINT "WidgetConversation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WidgetSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WidgetConversation" ADD CONSTRAINT "WidgetConversation_agentId_workspaceId_fkey" FOREIGN KEY ("agentId", "workspaceId") REFERENCES "AIAgent"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WidgetMessage" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
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
  CONSTRAINT "WidgetMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WidgetMessage_id_workspaceId_key" ON "WidgetMessage"("id", "workspaceId");
CREATE INDEX "WidgetMessage_conversationId_createdAt_idx" ON "WidgetMessage"("conversationId", "createdAt");
ALTER TABLE "WidgetMessage" ADD CONSTRAINT "WidgetMessage_conversationId_workspaceId_fkey" FOREIGN KEY ("conversationId", "workspaceId") REFERENCES "WidgetConversation"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WidgetMessage" ADD CONSTRAINT "WidgetMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WidgetMessageSource" (
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
  CONSTRAINT "WidgetMessageSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WidgetMessageSource_messageId_sourceNumber_key" ON "WidgetMessageSource"("messageId", "sourceNumber");
CREATE INDEX "WidgetMessageSource_workspaceId_createdAt_idx" ON "WidgetMessageSource"("workspaceId", "createdAt");
ALTER TABLE "WidgetMessageSource" ADD CONSTRAINT "WidgetMessageSource_messageId_workspaceId_fkey" FOREIGN KEY ("messageId", "workspaceId") REFERENCES "WidgetMessage"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WidgetMessageSource" ADD CONSTRAINT "WidgetMessageSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WidgetMessageSource" ADD CONSTRAINT "WidgetMessageSource_documentId_workspaceId_fkey" FOREIGN KEY ("documentId", "workspaceId") REFERENCES "KnowledgeDocument"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WidgetMessageSource" ADD CONSTRAINT "WidgetMessageSource_chunkId_workspaceId_fkey" FOREIGN KEY ("chunkId", "workspaceId") REFERENCES "KnowledgeChunk"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
