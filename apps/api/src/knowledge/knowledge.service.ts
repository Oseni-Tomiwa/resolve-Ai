import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { PrismaClient } from '@resolveai/database';
import { LocalStorage } from '@resolveai/storage';
import type { Express } from 'express';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { KnowledgeQueueService } from './knowledge-queue.service';
import type { KnowledgeChunkQueryDto, KnowledgeListQueryDto } from './dto';
// Nest dependency injection needs this service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { BillingUsageService } from '../billing/billing-usage.service';

const allowedMimeTypes = new Set(['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown']);
const maxFileSize = Number(process.env.KNOWLEDGE_MAX_FILE_SIZE_BYTES ?? 10 * 1024 * 1024);
const safeName = (name: string): string => name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160) || 'document';
const publicDocument = (document: Record<string, unknown>) => { const { storageKey: _storageKey, extractedText: _extractedText, _count: _documentCount, ...metadata } = document; return metadata; };
type Access = { organizationRole: string; workspaceRole: string; organizationId: string };
type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'EMBEDDING' | 'READY' | 'FAILED';

@Injectable()
export class KnowledgeService {
  private readonly storage = new LocalStorage(process.env.KNOWLEDGE_STORAGE_DIR);
  constructor(@Inject('PRISMA') private readonly db: PrismaClient, private readonly queue: KnowledgeQueueService, @Optional() private readonly billingUsage?: BillingUsageService) {}

  private async access(userId: string, workspaceId: string): Promise<Access> {
    const workspace = await this.db.workspace.findUnique({ where: { id: workspaceId }, select: { organizationId: true } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    const [organizationMember, workspaceMember] = await Promise.all([
      this.db.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId: workspace.organizationId } } }),
      this.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } }),
    ]);
    if (!organizationMember || (!workspaceMember && !['OWNER', 'ADMIN'].includes(organizationMember.role))) throw new ForbiddenException('Workspace membership required');
    return { organizationId: workspace.organizationId, organizationRole: organizationMember.role, workspaceRole: workspaceMember?.role ?? '' };
  }
  private async requireUploadAccess(userId: string, workspaceId: string): Promise<Access> { const access = await this.access(userId, workspaceId); if (access.workspaceRole === 'VIEWER') throw new ForbiddenException('Viewer access cannot upload documents'); return access; }
  private async requireDeleteAccess(userId: string, workspaceId: string): Promise<Access> { const access = await this.access(userId, workspaceId); if (access.workspaceRole !== 'ADMIN' && !['OWNER', 'ADMIN'].includes(access.organizationRole)) throw new ForbiddenException('Insufficient permissions to delete documents'); return access; }
  private async embeddingSummary(documentId: string, chunkCount: number, status: DocumentStatus) { const [embeddedChunkCount, latest] = await Promise.all([this.db.knowledgeEmbedding.count({ where: { documentId } }), this.db.knowledgeEmbedding.findFirst({ where: { documentId }, orderBy: { updatedAt: 'desc' }, select: { provider: true, model: true, dimensions: true } })]); return { chunkCount, embeddedChunkCount, embeddingProvider: latest?.provider ?? null, embeddingModel: latest?.model ?? null, embeddingDimensions: latest?.dimensions ?? null, embeddingStatus: status === 'FAILED' ? 'FAILED' : status === 'EMBEDDING' ? 'PROCESSING' : embeddedChunkCount === chunkCount && chunkCount > 0 ? 'COMPLETE' : 'NOT_STARTED' }; }

  async upload(userId: string, workspaceId: string, file: Express.Multer.File) {
    await this.requireUploadAccess(userId, workspaceId);
    if (!file || !file.buffer || file.size === 0) throw new ConflictException('The uploaded file is empty');
    if (file.size > maxFileSize) throw new ConflictException('Files must be 10 MB or smaller');
    if (!allowedMimeTypes.has(file.mimetype)) throw new ConflictException('Unsupported file type. Use PDF, TXT, or Markdown.');
    await this.billingUsage?.assertCanConsume(workspaceId, 'DOCUMENTS');
    await this.billingUsage?.assertCanConsume(workspaceId, 'STORAGE', file.size);
    const id = randomUUID(); const originalFileName = file.originalname.normalize('NFKC').slice(0, 255); const storageKey = `knowledge/${workspaceId}/${id}/${safeName(originalFileName)}`;
    await this.storage.save(storageKey, file.buffer);
    try {
      const document = await this.db.knowledgeDocument.create({ data: { id, workspaceId, uploadedByUserId: userId, name: originalFileName, originalFileName, mimeType: file.mimetype, sizeBytes: file.size, storageKey }, include: { uploadedBy: { select: { firstName: true, lastName: true, email: true } } } });
      try { await this.queue.add(document.id, workspaceId); } catch (error) { await this.db.knowledgeDocument.delete({ where: { id: document.id } }); throw error; }
      return publicDocument(document as unknown as Record<string, unknown>);
    } catch (error) { await this.storage.delete(storageKey); throw error; }
  }

  async list(userId: string, workspaceId: string, query: KnowledgeListQueryDto) {
    await this.access(userId, workspaceId); const page = query.page ?? 1; const pageSize = query.pageSize ?? 20; const search = query.search?.trim();
    const where = { workspaceId, deletedAt: null, ...(query.status ? { status: query.status as DocumentStatus } : {}), ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}) };
    const [total, documents] = await Promise.all([this.db.knowledgeDocument.count({ where }), this.db.knowledgeDocument.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { uploadedBy: { select: { firstName: true, lastName: true, email: true } }, _count: { select: { chunks: true } } } })]);
    const results = await Promise.all(documents.map(async (document) => ({ ...publicDocument(document as unknown as Record<string, unknown>), ...await this.embeddingSummary(document.id, document._count.chunks, document.status) })));
    return { documents: results, page, pageSize, total };
  }

  async detail(userId: string, workspaceId: string, documentId: string) { await this.access(userId, workspaceId); const document = await this.db.knowledgeDocument.findFirst({ where: { id: documentId, workspaceId, deletedAt: null }, include: { uploadedBy: { select: { firstName: true, lastName: true, email: true } }, _count: { select: { chunks: true } } } }); if (!document) throw new NotFoundException('Document not found'); const metadata = publicDocument(document as unknown as Record<string, unknown>); return { ...metadata, extractedText: document.extractedText, ...await this.embeddingSummary(document.id, document._count.chunks, document.status) }; }

  async chunks(userId: string, workspaceId: string, documentId: string, query: KnowledgeChunkQueryDto) { await this.access(userId, workspaceId); const document = await this.db.knowledgeDocument.findFirst({ where: { id: documentId, workspaceId, deletedAt: null }, select: { id: true } }); if (!document) throw new NotFoundException('Document not found'); const page = query.page ?? 1; const limit = query.limit ?? 20; const where = { documentId, workspaceId }; const total = await this.db.knowledgeChunk.count({ where }); const chunks = query.includeContent === 'false' ? await this.db.knowledgeChunk.findMany({ where, orderBy: { chunkIndex: 'asc' }, skip: (page - 1) * limit, take: limit, select: { id: true, chunkIndex: true, characterStart: true, characterEnd: true, tokenCountEstimate: true, createdAt: true } }) : await this.db.knowledgeChunk.findMany({ where, orderBy: { chunkIndex: 'asc' }, skip: (page - 1) * limit, take: limit, select: { id: true, chunkIndex: true, characterStart: true, characterEnd: true, tokenCountEstimate: true, content: true, createdAt: true } }); return { chunks, page, limit, total }; }

  async reprocess(userId: string, workspaceId: string, documentId: string) { await this.requireUploadAccess(userId, workspaceId); const document = await this.db.knowledgeDocument.findFirst({ where: { id: documentId, workspaceId, deletedAt: null }, select: { id: true, workspaceId: true } }); if (!document) throw new NotFoundException('Document not found'); await this.db.knowledgeDocument.update({ where: { id: document.id }, data: { status: 'UPLOADED', processingError: null } }); await this.queue.add(document.id, document.workspaceId); return { id: document.id, status: 'UPLOADED' }; }

  async remove(userId: string, workspaceId: string, documentId: string): Promise<void> { await this.requireDeleteAccess(userId, workspaceId); const document = await this.db.knowledgeDocument.findFirst({ where: { id: documentId, workspaceId, deletedAt: null } }); if (!document) throw new NotFoundException('Document not found'); await this.db.knowledgeDocument.update({ where: { id: document.id }, data: { deletedAt: new Date() } }); await this.storage.delete(document.storageKey); }
}
