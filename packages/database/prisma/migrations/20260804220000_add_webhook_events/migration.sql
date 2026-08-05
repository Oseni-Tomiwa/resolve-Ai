CREATE TABLE "WebhookEvent" ("id" UUID NOT NULL, "workspaceId" UUID NOT NULL, "eventKey" TEXT NOT NULL, "eventType" TEXT NOT NULL, "payload" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "WebhookEvent_eventKey_key" ON "WebhookEvent"("eventKey"); CREATE INDEX "WebhookEvent_workspaceId_createdAt_idx" ON "WebhookEvent"("workspaceId", "createdAt");
ALTER TABLE "WebhookDelivery" ADD COLUMN "responseBody" TEXT, ADD COLUMN "durationMs" INTEGER, ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
