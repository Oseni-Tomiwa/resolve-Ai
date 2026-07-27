import { loadEmbeddingEnv, loadGenerationEnv } from '@resolveai/config';

describe('AI environment contract', () => {
  it('allows a safe development configuration without an API key', () => {
    // Arrange / Act
    const generation = loadGenerationEnv({});
    const embedding = loadEmbeddingEnv({});
    // Assert
    expect(generation.OPENAI_API_KEY).toBeUndefined();
    expect(generation.OPENAI_GENERATION_MODEL).toBe('gpt-4o-mini');
    expect(embedding.OPENAI_EMBEDDING_MODEL).toBe('text-embedding-3-small');
  });

  it('accepts a valid key and canonical model settings without exposing the key', () => {
    // Arrange / Act
    const generation = loadGenerationEnv({ OPENAI_API_KEY: 'sk-test-only', OPENAI_GENERATION_MODEL: 'gpt-4o-mini', AI_MAX_OUTPUT_TOKENS: '600', AI_RETRIEVAL_LIMIT: '5', AI_MINIMUM_SCORE: '0.65' });
    // Assert
    expect(generation).toMatchObject({ OPENAI_GENERATION_MODEL: 'gpt-4o-mini', AI_MAX_OUTPUT_TOKENS: 600 });
    expect(JSON.stringify({ model: generation.OPENAI_GENERATION_MODEL })).not.toContain('sk-test-only');
  });

  it('rejects unsupported models and invalid numeric settings', () => {
    // Arrange / Act / Assert
    expect(() => loadGenerationEnv({ OPENAI_GENERATION_MODEL: 'unknown-model' })).toThrow();
    expect(() => loadEmbeddingEnv({ OPENAI_EMBEDDING_MODEL: 'unknown-embedding' })).toThrow();
    expect(() => loadGenerationEnv({ AI_MAX_OUTPUT_TOKENS: '20' })).toThrow();
    expect(() => loadGenerationEnv({ AI_RETRIEVAL_LIMIT: '0' })).toThrow();
    expect(() => loadGenerationEnv({ AI_MINIMUM_SCORE: '1.2' })).toThrow();
    expect(() => loadEmbeddingEnv({ EMBEDDING_BATCH_SIZE: '0' })).toThrow();
  });
});
