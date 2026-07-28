import { Prisma, type PrismaClient } from '@resolveai/database';
import { OpenAIEmbeddingProvider, type EmbeddingProvider } from '@resolveai/ai';
import { type EmbeddingEnv } from '@resolveai/config';
import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WorkspaceAccessService } from '../workspace-access/workspace-access.service';
import type { SemanticSearchDto } from './semantic-search.dto';

export const SEMANTIC_EMBEDDING_PROVIDER = 'SEMANTIC_EMBEDDING_PROVIDER';
export const EMBEDDING_CONFIG = 'EMBEDDING_CONFIG';
const dimensions = 1536;
const clampScore = (value: number): number => Math.max(0, Math.min(1, value));
const vectorLiteral = (vector: readonly number[]): string => `[${vector.map((value) => value.toString()).join(',')}]`;

type SearchRow = {
  chunkId: string;
  chunkIndex: number;
  content: string;
  similarityScore: number;
  documentId: string;
  documentName: string;
  originalFileName: string;
  mimeType: string;
  characterStart: number | null;
  characterEnd: number | null;
  createdAt: Date;
};

@Injectable()
export class EnvironmentEmbeddingProvider implements EmbeddingProvider {
  readonly provider = 'openai';
  readonly dimensions = dimensions;
  constructor(@Inject(EMBEDDING_CONFIG) private readonly config: EmbeddingEnv) {}
  get model(): string { return this.config.OPENAI_EMBEDDING_MODEL; }

  async embed(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (!this.config.OPENAI_API_KEY) throw new ServiceUnavailableException('Semantic search embeddings are not configured');
    return new OpenAIEmbeddingProvider({ apiKey: this.config.OPENAI_API_KEY, model: this.model, dimensions }).embed(texts);
  }
}

@Injectable()
export class SemanticSearchService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient, private readonly workspaceAccess: WorkspaceAccessService, @Inject(SEMANTIC_EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider) {}

  async search(userId: string, workspaceId: string, input: SemanticSearchDto) {
    await this.workspaceAccess.assertMember(userId, workspaceId);
    return this.searchInternal(workspaceId, input);
  }

  async searchPublic(workspaceId: string, input: SemanticSearchDto) {
    return this.searchInternal(workspaceId, input);
  }

  private async searchInternal(workspaceId: string, input: SemanticSearchDto) {
    const query = input.query.trim();
    if (!query) throw new BadRequestException('Search query cannot be empty');
    if (query.length > 1000) throw new BadRequestException('Search query must be 1000 characters or fewer');
    const limit = input.limit ?? 5;
    const minimumScore = input.minimumScore ?? 0.65;
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new BadRequestException('Search limit must be between 1 and 20');
    if (!Number.isFinite(minimumScore) || minimumScore < 0 || minimumScore > 1) throw new BadRequestException('Minimum score must be between 0 and 1');

    const documentIds = input.documentIds ?? [];
    if (documentIds.length > 0) {
      const documents = await this.db.knowledgeDocument.findMany({ where: { id: { in: documentIds }, workspaceId, deletedAt: null }, select: { id: true } });
      const validIds = new Set(documents.map((document) => document.id));
      if (documentIds.some((documentId) => !validIds.has(documentId))) throw new BadRequestException('Every document filter must belong to this workspace and be active');
    }

    const readyCount = await this.db.knowledgeDocument.count({ where: { workspaceId, status: 'READY', deletedAt: null, ...(documentIds.length > 0 ? { id: { in: documentIds } } : {}) } });
    console.info(JSON.stringify({ event: 'knowledge.semantic_search_started', workspaceId, queryLength: query.length, documentFilterCount: documentIds.length, readyDocumentCount: readyCount, provider: this.embeddingProvider.provider, model: this.embeddingProvider.model, dimensions: this.embeddingProvider.dimensions }));
    if (readyCount === 0) return { query, results: [] };

    const vectors = await this.embeddingProvider.embed([query]);
    const queryVector = vectors[0];
    if (!queryVector || queryVector.length !== this.embeddingProvider.dimensions || queryVector.some((value) => !Number.isFinite(value))) throw new ServiceUnavailableException('The embedding provider returned an invalid query vector');
    console.info(JSON.stringify({ event: 'knowledge.query_embedding_generated', workspaceId, vectorCount: vectors.length, dimensions: queryVector.length, provider: this.embeddingProvider.provider, model: this.embeddingProvider.model }));
    const documentFilter = documentIds.length > 0 ? Prisma.sql`AND d."id" IN (${Prisma.join(documentIds.map((documentId) => Prisma.sql`${documentId}::uuid`))})` : Prisma.empty;
    const vector = vectorLiteral(queryVector);
    const rows = await this.db.$queryRaw<SearchRow[]>(Prisma.sql`
      SELECT ranked."chunkId", ranked."chunkIndex", ranked."content", ranked."similarityScore", ranked."documentId", ranked."documentName", ranked."originalFileName", ranked."mimeType", ranked."characterStart", ranked."characterEnd", ranked."createdAt"
      FROM (
        SELECT c."id" AS "chunkId", c."chunkIndex", c."content",
          GREATEST(0, LEAST(1, 1 - (e."embedding" <=> ${vector}::vector))) AS "similarityScore",
          d."id" AS "documentId", d."name" AS "documentName", d."originalFileName", d."mimeType", c."characterStart", c."characterEnd", c."createdAt"
        FROM "KnowledgeEmbedding" e
        INNER JOIN "KnowledgeChunk" c ON c."id" = e."chunkId" AND c."workspaceId" = e."workspaceId"
        INNER JOIN "KnowledgeDocument" d ON d."id" = e."documentId" AND d."workspaceId" = e."workspaceId"
        WHERE e."workspaceId" = ${workspaceId}::uuid
          AND e."provider" = ${this.embeddingProvider.provider}
          AND e."model" = ${this.embeddingProvider.model}
          AND e."dimensions" = ${this.embeddingProvider.dimensions}
          AND d."status" = 'READY'
          AND d."deletedAt" IS NULL
          ${documentFilter}
      ) ranked
      WHERE ranked."similarityScore" >= ${minimumScore}
      ORDER BY ranked."similarityScore" DESC, ranked."chunkIndex" ASC
      LIMIT ${limit}
    `);
    const results = rows.map((row) => ({ chunkId: row.chunkId, chunkIndex: row.chunkIndex, content: row.content, similarityScore: clampScore(Number(row.similarityScore)), document: { id: row.documentId, name: row.documentName, originalFileName: row.originalFileName, mimeType: row.mimeType }, characterStart: row.characterStart, characterEnd: row.characterEnd, createdAt: row.createdAt }));
    console.info(JSON.stringify({ event: 'knowledge.semantic_search_completed', workspaceId, resultCount: results.length, minimumScore, limit }));
    return { query, results };
  }
}
