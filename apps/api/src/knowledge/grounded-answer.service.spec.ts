import { DeterministicTextGenerationProvider, type GroundedAnswerInput, type GroundedAnswerOutput, type TextGenerationProvider } from '@resolveai/ai';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { GroundedAnswerService } from './grounded-answer.service';

const config = { OPENAI_API_KEY: undefined, OPENAI_GENERATION_MODEL: 'gpt-4o-mini', AI_MAX_OUTPUT_TOKENS: 800, AI_RETRIEVAL_LIMIT: 5, AI_MINIMUM_SCORE: 0.65 };

const retrieval = { query: 'What is the refund policy?', results: [{ chunkId: 'chunk-1', chunkIndex: 4, content: 'Customers may request a refund within 30 days.', similarityScore: 0.91, document: { id: 'doc-1', name: 'Refund Policy', originalFileName: 'refund.md', mimeType: 'text/markdown' }, characterStart: 10, characterEnd: 56, createdAt: new Date('2026-01-01T00:00:00.000Z') }] };

describe('GroundedAnswerService', () => {
  it('retrieves context, generates a grounded answer, and maps citations to safe sources', async () => {
    // Arrange
    const semanticSearch = { search: jest.fn().mockResolvedValue(retrieval) };
    const provider = new DeterministicTextGenerationProvider();
    const service = new GroundedAnswerService(semanticSearch as never, provider, config);
    // Act
    const result = await service.answer('user-1', 'workspace-1', { question: 'What is the refund policy?' });
    // Assert
    expect(result.answer).toContain('[1]');
    expect(result.sources).toEqual([expect.objectContaining({ number: 1, documentId: 'doc-1', cited: true, similarityScore: 0.91 })]);
    expect(result).not.toHaveProperty('prompt');
  });

  it('does not call generation when retrieval has no sufficient context', async () => {
    // Arrange
    const semanticSearch = { search: jest.fn().mockResolvedValue({ query: 'unknown', results: [] }) };
    const provider = { provider: 'test', model: 'test', generateGroundedAnswer: jest.fn() } as unknown as TextGenerationProvider;
    const service = new GroundedAnswerService(semanticSearch as never, provider, config);
    // Act
    const result = await service.answer('user-1', 'workspace-1', { question: 'unknown' });
    // Assert
    expect(result.sources).toEqual([]);
    expect(result.answer).toContain('couldn’t find enough information');
    expect(provider.generateGroundedAnswer).not.toHaveBeenCalled();
  });

  it('passes an agent document selection to workspace-scoped retrieval', async () => {
    // Arrange
    const semanticSearch = { search: jest.fn().mockResolvedValue(retrieval) };
    const service = new GroundedAnswerService(semanticSearch as never, new DeterministicTextGenerationProvider(), config);
    // Act
    await service.prepare('user-1', 'workspace-1', 'What is the refund policy?', ['doc-ignored-by-agent'], { documentIds: ['doc-1'] });
    // Assert
    expect(semanticSearch.search).toHaveBeenCalledWith('user-1', 'workspace-1', expect.objectContaining({ query: 'What is the refund policy?', documentIds: ['doc-1'] }));
  });

  it('rejects empty questions and filters citations to supplied sources', async () => {
    // Arrange
    const semanticSearch = { search: jest.fn().mockResolvedValue(retrieval) };
    const provider: TextGenerationProvider = { provider: 'test', model: 'test-v1', generateGroundedAnswer: jest.fn(async (input: GroundedAnswerInput): Promise<GroundedAnswerOutput> => ({ answer: 'Supported [1] and fabricated [999].', citedSourceNumbers: [1, 999], provider: 'test', model: 'test-v1', usage: { inputTokens: input.context.length, outputTokens: 4 } })) };
    const service = new GroundedAnswerService(semanticSearch as never, provider, config);
    // Act / Assert
    await expect(service.answer('user-1', 'workspace-1', { question: ' ' })).rejects.toThrow(BadRequestException);
    const result = await service.answer('user-1', 'workspace-1', { question: 'What is the refund policy?' });
    expect(result.sources[0]?.cited).toBe(true);
    expect(result.sources.some((source) => source.number === 999)).toBe(false);
  });

  it('returns a controlled provider failure', async () => {
    // Arrange
    const semanticSearch = { search: jest.fn().mockResolvedValue(retrieval) };
    const provider: TextGenerationProvider = { provider: 'test', model: 'test-v1', generateGroundedAnswer: jest.fn().mockRejectedValue(new Error('provider timeout')) };
    const service = new GroundedAnswerService(semanticSearch as never, provider, config);
    // Act / Assert
    await expect(service.answer('user-1', 'workspace-1', { question: 'What is the refund policy?' })).rejects.toThrow(ServiceUnavailableException);
  });
});
