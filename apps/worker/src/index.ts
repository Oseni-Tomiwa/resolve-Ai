import { config } from 'dotenv';
import { Worker } from 'bullmq';
import { resolve } from 'node:path';
import { prisma } from '@resolveai/database';
import { LocalStorage } from '@resolveai/storage';
import { loadEmbeddingEnv } from '@resolveai/config';
import { chunkText } from './chunking.js';
import { createProductionEmbeddingProvider, embedDocumentChunks } from './embedding.js';
import { extractText } from './processing.js';

config({ path: resolve(process.cwd(), '../../.env') });

const queueName = 'knowledge-processing';
const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
const storage = new LocalStorage(process.env.KNOWLEDGE_STORAGE_DIR);

async function processDocument(documentId: string, workspaceId: string): Promise<void> {
  const document = await prisma.knowledgeDocument.findFirst({ where: { id: documentId, workspaceId, deletedAt: null } });
  if (!document) return;
  await prisma.knowledgeDocument.update({ where: { id: document.id }, data: { status: 'PROCESSING', processingError: null } });
  try {
    const text = await extractText(document.mimeType, await storage.read(document.storageKey));
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error('No readable text was found in this document');
    const committed = await prisma.$transaction(async (tx) => {
      const current = await tx.knowledgeDocument.findFirst({ where: { id: document.id, workspaceId, deletedAt: null }, select: { id: true } });
      if (!current) return false;
      const existing = await tx.knowledgeChunk.findMany({ where: { documentId: document.id }, select: { id: true, chunkIndex: true } });
      const existingByIndex = new Map(existing.map((chunk) => [chunk.chunkIndex, chunk.id]));
      const indexes = chunks.map((chunk) => chunk.chunkIndex);
      await tx.knowledgeChunk.deleteMany({ where: { documentId: document.id, chunkIndex: { notIn: indexes } } });
      for (const chunk of chunks) {
        const existingId = existingByIndex.get(chunk.chunkIndex);
        if (existingId) {
          await tx.knowledgeChunk.update({ where: { id: existingId }, data: { content: chunk.content, characterStart: chunk.characterStart, characterEnd: chunk.characterEnd, tokenCountEstimate: chunk.tokenCountEstimate } });
        } else {
          await tx.knowledgeChunk.create({ data: { documentId: document.id, workspaceId, content: chunk.content, chunkIndex: chunk.chunkIndex, characterStart: chunk.characterStart, characterEnd: chunk.characterEnd, tokenCountEstimate: chunk.tokenCountEstimate } });
        }
      }
      await tx.knowledgeDocument.update({ where: { id: document.id }, data: { status: 'EMBEDDING', extractedText: text, processedAt: new Date(), processingError: null } });
      return true;
    });
    if (!committed) return;
    const embeddingEnv = loadEmbeddingEnv(process.env);
    const result = await embedDocumentChunks(prisma, document.id, workspaceId, createProductionEmbeddingProvider(), embeddingEnv.EMBEDDING_BATCH_SIZE);
    await prisma.knowledgeDocument.updateMany({ where: { id: document.id, workspaceId, deletedAt: null }, data: { status: 'READY', processingError: null } });
    console.info(JSON.stringify({ event: 'knowledge.document_ready', documentId, workspaceId, chunkCount: chunks.length, embeddedChunkCount: result.embeddedChunkCount, skippedChunkCount: result.skippedChunkCount }));
  } catch (error) {
    const processingError = error instanceof Error ? error.message.slice(0, 240) : 'Document processing failed';
    await prisma.knowledgeDocument.updateMany({ where: { id: document.id, workspaceId, deletedAt: null }, data: { status: 'FAILED', processingError } });
    console.error(JSON.stringify({ event: 'knowledge.document_failed', documentId, workspaceId, error: processingError }));
    throw error;
  }
}

const worker = new Worker(queueName, async (job) => {
  const { documentId, workspaceId } = job.data as { documentId: string; workspaceId: string };
  await processDocument(documentId, workspaceId);
}, { connection, concurrency: 2 });

worker.on('failed', (job, error) => console.error(JSON.stringify({ event: 'knowledge.job_failed', jobId: job?.id, error: error.message })));
worker.on('error', (error) => console.error(JSON.stringify({ event: 'knowledge.worker_error', error: error.message })));
console.info(JSON.stringify({ event: 'knowledge.worker_ready', queue: queueName }));

async function shutdown(signal: string): Promise<void> { console.info(JSON.stringify({ event: 'knowledge.worker_shutdown', signal })); await worker.close(); await prisma.$disconnect(); }
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
