import { createHash, randomUUID } from 'node:crypto';
import { OpenAIEmbeddingProvider, type EmbeddingProvider } from '@resolveai/ai';
import { loadEmbeddingEnv, type EmbeddingEnv } from '@resolveai/config';
import type { PrismaClient } from '@resolveai/database';

type EmbeddingMetadata = { chunkId: string; provider: string; model: string; dimensions: number; contentHash: string };
type EmbeddableChunk = { id: string; content: string };

export const contentHash = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex');

export function createProductionEmbeddingProvider(config: EmbeddingEnv = loadEmbeddingEnv(process.env)): EmbeddingProvider {
  const env = config;
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured; document embeddings cannot be generated');
  return new OpenAIEmbeddingProvider({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_EMBEDDING_MODEL, dimensions: 1536 });
}

const vectorLiteral = (vector: readonly number[]): string => `[${vector.map((value) => {
  if (!Number.isFinite(value)) throw new Error('Embedding provider returned a non-finite value');
  return value.toString();
}).join(',')}]`;

export async function embedDocumentChunks(db: PrismaClient, documentId: string, workspaceId: string, provider: EmbeddingProvider, batchSize: number): Promise<{ embeddedChunkCount: number; skippedChunkCount: number }> {
  const chunks: EmbeddableChunk[] = await db.knowledgeChunk.findMany({ where: { documentId, workspaceId }, orderBy: { chunkIndex: 'asc' }, select: { id: true, content: true } });
  const hashes = chunks.map((chunk) => ({ ...chunk, hash: contentHash(chunk.content) }));
  const existing = await db.knowledgeEmbedding.findMany({ where: { documentId, workspaceId, provider: provider.provider, model: provider.model, dimensions: provider.dimensions }, select: { chunkId: true, provider: true, model: true, dimensions: true, contentHash: true } });
  const existingByChunk = new Map(existing.map((item) => [item.chunkId, item as EmbeddingMetadata]));
  const pending = hashes.filter((chunk) => existingByChunk.get(chunk.id)?.contentHash !== chunk.hash);
  let embeddedChunkCount = 0;
  for (let start = 0; start < pending.length; start += batchSize) {
    const batch = pending.slice(start, start + batchSize);
    const vectors = await provider.embed(batch.map((chunk) => chunk.content));
    if (vectors.length !== batch.length) throw new Error(`Embedding provider returned ${vectors.length} vectors for ${batch.length} chunks`);
    for (const [index, chunk] of batch.entries()) {
      const vector = vectors[index];
      if (!vector || vector.length !== provider.dimensions || vector.some((value) => !Number.isFinite(value))) throw new Error(`Embedding provider returned an invalid vector for chunk ${chunk.id}`);
      const literal = vectorLiteral(vector);
      await db.$executeRaw`
        INSERT INTO "KnowledgeEmbedding" ("id", "workspaceId", "documentId", "chunkId", "provider", "model", "dimensions", "embedding", "contentHash", "createdAt", "updatedAt")
        VALUES (${randomUUID()}::uuid, ${workspaceId}::uuid, ${documentId}::uuid, ${chunk.id}::uuid, ${provider.provider}, ${provider.model}, ${provider.dimensions}, ${literal}::vector, ${chunk.hash}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("chunkId", "provider", "model", "dimensions") DO UPDATE SET "embedding" = EXCLUDED."embedding", "contentHash" = EXCLUDED."contentHash", "updatedAt" = CURRENT_TIMESTAMP
      `;
      embeddedChunkCount += 1;
    }
  }
  return { embeddedChunkCount, skippedChunkCount: chunks.length - pending.length };
}
