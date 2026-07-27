CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "KnowledgeDocumentStatus_new" AS ENUM ('UPLOADED', 'PROCESSING', 'EMBEDDING', 'READY', 'FAILED');
ALTER TABLE "KnowledgeDocument" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "KnowledgeDocument" ALTER COLUMN "status" TYPE "KnowledgeDocumentStatus_new" USING ("status"::text::"KnowledgeDocumentStatus_new");
DROP TYPE "KnowledgeDocumentStatus";
ALTER TYPE "KnowledgeDocumentStatus_new" RENAME TO "KnowledgeDocumentStatus";
ALTER TABLE "KnowledgeDocument" ALTER COLUMN "status" SET DEFAULT 'UPLOADED';

CREATE TABLE "KnowledgeEmbedding" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "chunkId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeEmbedding_chunkId_provider_model_dimensions_key" ON "KnowledgeEmbedding"("chunkId", "provider", "model", "dimensions");
CREATE INDEX "KnowledgeEmbedding_workspaceId_idx" ON "KnowledgeEmbedding"("workspaceId");
CREATE INDEX "KnowledgeEmbedding_documentId_idx" ON "KnowledgeEmbedding"("documentId");
CREATE INDEX "KnowledgeEmbedding_chunkId_idx" ON "KnowledgeEmbedding"("chunkId");
CREATE INDEX "KnowledgeEmbedding_workspaceId_provider_model_dimensions_idx" ON "KnowledgeEmbedding"("workspaceId", "provider", "model", "dimensions");

ALTER TABLE "KnowledgeEmbedding" ADD CONSTRAINT "KnowledgeEmbedding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEmbedding" ADD CONSTRAINT "KnowledgeEmbedding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEmbedding" ADD CONSTRAINT "KnowledgeEmbedding_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
