import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { DeterministicEmbeddingProvider } from '@resolveai/ai';
import { SemanticSearchService } from './semantic-search.service';

const input = (overrides: Partial<{ query: string; limit: number; minimumScore: number; documentIds: string[] }> = {}) => ({ query: 'How can a customer request a refund?', limit: 5, minimumScore: 0.65, ...overrides });

describe('SemanticSearchService', () => {
  function setup() {
    const provider = new DeterministicEmbeddingProvider(4);
    const database = {
      knowledgeDocument: { findMany: jest.fn().mockResolvedValue([{ id: 'doc-1' }]) },
      $queryRaw: jest.fn().mockResolvedValue([{ chunkId: 'chunk-1', chunkIndex: 2, content: 'Refunds are available within 30 days.', similarityScore: 0.91, documentId: 'doc-1', documentName: 'Refund policy', originalFileName: 'refunds.md', mimeType: 'text/markdown', characterStart: 0, characterEnd: 39, createdAt: new Date('2026-01-01T00:00:00.000Z') }]),
    };
    const workspaceAccess = { assertMember: jest.fn().mockResolvedValue(undefined) };
    const service = new SemanticSearchService(database as never, workspaceAccess as never, provider);
    return { provider, database, workspaceAccess, service };
  }

  it('returns ranked safe source metadata for an authorized workspace', async () => {
    // Arrange
    const { service, database } = setup();
    // Act
    const result = await service.search('user-1', 'workspace-1', input());
    // Assert
    expect(result.results[0]).toMatchObject({ chunkId: 'chunk-1', similarityScore: 0.91, document: { id: 'doc-1', name: 'Refund policy' } });
    expect(result.results[0]).not.toHaveProperty('embedding');
    expect(database.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid query controls and preserves tenant authorization', async () => {
    // Arrange
    const { service, workspaceAccess } = setup();
    workspaceAccess.assertMember.mockRejectedValue(new ForbiddenException('Workspace membership required'));
    // Act / Assert
    await expect(service.search('user-1', 'other-workspace', input())).rejects.toThrow(ForbiddenException);
    workspaceAccess.assertMember.mockResolvedValue(undefined);
    await expect(service.search('user-1', 'workspace-1', input({ query: ' ' }))).rejects.toThrow(BadRequestException);
    await expect(service.search('user-1', 'workspace-1', input({ limit: 21 }))).rejects.toThrow(BadRequestException);
    await expect(service.search('user-1', 'workspace-1', input({ minimumScore: 1.1 }))).rejects.toThrow(BadRequestException);
  });

  it('rejects filters outside the selected workspace and unavailable embedding configuration', async () => {
    // Arrange
    const { service, database } = setup();
    database.knowledgeDocument.findMany.mockResolvedValue([]);
    // Act / Assert
    await expect(service.search('user-1', 'workspace-1', input({ documentIds: ['00000000-0000-4000-8000-000000000001'] }))).rejects.toThrow(BadRequestException);
    const unavailable = new SemanticSearchService(database as never, { assertMember: jest.fn().mockResolvedValue(undefined) } as never, { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536, embed: jest.fn().mockRejectedValue(new ServiceUnavailableException('unavailable')) });
    await expect(unavailable.search('user-1', 'workspace-1', input())).rejects.toThrow(ServiceUnavailableException);
  });
});
