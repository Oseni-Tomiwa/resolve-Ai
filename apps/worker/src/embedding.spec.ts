import { DeterministicEmbeddingProvider } from '@resolveai/ai';
import { contentHash, embedDocumentChunks } from './embedding.js';

describe('embedDocumentChunks', () => {
  it('batches missing chunks and reuses matching content hashes', async () => {
    // Arrange
    const provider = new DeterministicEmbeddingProvider(4);
    const executeRaw = jest.fn().mockResolvedValue(1);
    const database = {
      knowledgeChunk: { findMany: jest.fn().mockResolvedValue([{ id: 'chunk-1', content: 'one' }, { id: 'chunk-2', content: 'two' }, { id: 'chunk-3', content: 'three' }]) },
      knowledgeEmbedding: { findMany: jest.fn().mockResolvedValue([{ chunkId: 'chunk-1', provider: provider.provider, model: provider.model, dimensions: provider.dimensions, contentHash: contentHash('one') }]) },
      $executeRaw: executeRaw,
    };
    // Act
    const result = await embedDocumentChunks(database as never, 'document-1', 'workspace-1', provider, 1);
    // Assert
    expect(result).toEqual({ embeddedChunkCount: 2, skippedChunkCount: 1 });
    expect(executeRaw).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed provider vectors before persistence', async () => {
    // Arrange
    const provider = { provider: 'test', model: 'bad', dimensions: 2, embed: jest.fn().mockResolvedValue([[1]]) };
    const database = { knowledgeChunk: { findMany: jest.fn().mockResolvedValue([{ id: 'chunk-1', content: 'one' }]) }, knowledgeEmbedding: { findMany: jest.fn().mockResolvedValue([]) }, $executeRaw: jest.fn() };
    // Act / Assert
    await expect(embedDocumentChunks(database as never, 'document-1', 'workspace-1', provider, 10)).rejects.toThrow('invalid vector');
    expect(database.$executeRaw).not.toHaveBeenCalled();
  });
});
