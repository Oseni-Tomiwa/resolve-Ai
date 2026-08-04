import { createServer } from 'node:http';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '@resolveai/database';
import { createStorageFromEnv } from '@resolveai/storage';
import { loadEmbeddingEnv, loadRootEnv, validateRuntimeEnv } from '@resolveai/config';
import { chunkText } from './chunking.js';
import { createProductionEmbeddingProvider, embedDocumentChunks } from './embedding.js';
import { extractText } from './processing.js';
import { processingErrorCategory } from './error-category.js';

loadRootEnv();
const runtimeEnv = validateRuntimeEnv(process.env);

const queueName = 'knowledge-processing';
const connection = { url: runtimeEnv.REDIS_URL };
const storage = createStorageFromEnv(process.env);

const withTimeout = <T>(task: Promise<T>, timeoutMs: number): Promise<T> => new Promise<T>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('WORKER_JOB_TIMEOUT')), timeoutMs); task.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => { clearTimeout(timer); reject(error); }); });

async function processDocument(documentId: string, workspaceId: string): Promise<void> {
  const document = await prisma.knowledgeDocument.findFirst({ where: { id: documentId, workspaceId, deletedAt: null } });
  if (!document) return;
  console.info(JSON.stringify({ event: 'knowledge.document_processing_started', documentId, workspaceId, mimeType: document.mimeType }));
  await prisma.knowledgeDocument.update({ where: { id: document.id }, data: { status: 'PROCESSING', processingError: null } });
  try {
    const text = await extractText(document.mimeType, await storage.read(document.storageKey));
    console.info(JSON.stringify({ event: 'knowledge.document_extracted', documentId, workspaceId, characterCount: text.length }));
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error('No readable text was found in this document');
    console.info(JSON.stringify({ event: 'knowledge.document_chunked', documentId, workspaceId, chunkCount: chunks.length }));
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
    console.info(JSON.stringify({ event: 'knowledge.document_chunks_persisted', documentId, workspaceId, chunkCount: chunks.length }));
    const embeddingEnv = loadEmbeddingEnv(process.env);
    const embeddingProvider = createProductionEmbeddingProvider(embeddingEnv);
    console.info(JSON.stringify({ event: 'knowledge.embedding_generation_started', documentId, workspaceId, provider: embeddingProvider.provider, model: embeddingProvider.model, dimensions: embeddingProvider.dimensions, batchSize: embeddingEnv.EMBEDDING_BATCH_SIZE, chunkCount: chunks.length }));
    const result = await embedDocumentChunks(prisma, document.id, workspaceId, embeddingProvider, embeddingEnv.EMBEDDING_BATCH_SIZE);
    console.info(JSON.stringify({ event: 'knowledge.embedding_generation_completed', documentId, workspaceId, provider: embeddingProvider.provider, model: embeddingProvider.model, dimensions: embeddingProvider.dimensions, embeddedChunkCount: result.embeddedChunkCount, skippedChunkCount: result.skippedChunkCount }));
    await prisma.knowledgeDocument.updateMany({ where: { id: document.id, workspaceId, deletedAt: null }, data: { status: 'READY', processingError: null } });
    console.info(JSON.stringify({ event: 'knowledge.document_ready', documentId, workspaceId, chunkCount: chunks.length, embeddedChunkCount: result.embeddedChunkCount, skippedChunkCount: result.skippedChunkCount }));
  } catch (error) {
    const category = processingErrorCategory(error);
    await prisma.knowledgeDocument.updateMany({ where: { id: document.id, workspaceId, deletedAt: null }, data: { status: 'FAILED', processingError: category } });
    console.error(JSON.stringify({ event: 'knowledge.document_failed', documentId, workspaceId, category }));
    throw error;
  }
}

async function recoverInterruptedDocuments(): Promise<void> {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  await prisma.knowledgeDocument.updateMany({
    where: { status: { in: ['PROCESSING', 'EMBEDDING'] }, updatedAt: { lt: cutoff }, deletedAt: null },
    data: { status: 'FAILED', processingError: 'WORKER_INTERRUPTED' },
  });
}

const worker = new Worker(queueName, async (job) => {
  const { documentId, workspaceId } = job.data as { documentId: string; workspaceId: string };
  await withTimeout(processDocument(documentId, workspaceId), runtimeEnv.WORKER_JOB_TIMEOUT_MS);
}, { connection, concurrency: runtimeEnv.WORKER_CONCURRENCY });

const readinessRedis = new Redis(runtimeEnv.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
const healthServer = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.url === '/health') { response.statusCode = 200; response.end(JSON.stringify({ success: true, data: { status: 'ok' } })); return; }
  if (request.url !== '/ready') { response.statusCode = 404; response.end(JSON.stringify({ success: false, message: 'Not found' })); return; }
  const [database, redis] = await Promise.all([
    prisma.$queryRawUnsafe('SELECT 1').then(() => 'ok').catch(() => 'unavailable'),
    (async () => { try { if (readinessRedis.status === 'wait') await readinessRedis.connect(); await readinessRedis.ping(); return 'ok'; } catch { return 'unavailable'; } })(),
  ]);
  const ready = worker.isRunning() && database === 'ok' && redis === 'ok';
  response.statusCode = ready ? 200 : 503;
  response.end(JSON.stringify({ success: ready, data: { status: ready ? 'ready' : 'degraded', worker: worker.isRunning() ? 'ok' : 'unavailable', database, redis } }));
});
healthServer.listen(runtimeEnv.WORKER_PORT, () => console.info(JSON.stringify({ event: 'knowledge.worker_health_ready', service: 'resolveai-worker', environment: runtimeEnv.NODE_ENV, port: runtimeEnv.WORKER_PORT })));

worker.on('failed', (job, error) => console.error(JSON.stringify({ event: 'knowledge.job_failed', jobId: job?.id, category: processingErrorCategory(error) })));
worker.on('error', (error) => console.error(JSON.stringify({ event: 'knowledge.worker_error', category: processingErrorCategory(error) })));
void recoverInterruptedDocuments().catch(() => console.error(JSON.stringify({ event: 'knowledge.recovery_failed', category: 'DATABASE_UNAVAILABLE' })));
console.info(JSON.stringify({ event: 'knowledge.worker_ready', queue: queueName }));

async function shutdown(signal: string): Promise<void> { console.info(JSON.stringify({ event: 'knowledge.worker_shutdown', service: 'resolveai-worker', environment: runtimeEnv.NODE_ENV, signal })); await new Promise<void>((resolve) => healthServer.close(() => resolve())); await worker.close(); await readinessRedis.quit().catch(() => undefined); await prisma.$disconnect(); }
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
