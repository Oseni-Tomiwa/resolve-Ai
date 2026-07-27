import { CHUNKING, chunkText } from './chunking.js';

describe('chunkText', () => {
  it('keeps a short document in one chunk', () => {
    // Arrange / Act
    const chunks = chunkText('A short support guide.');
    // Assert
    expect(chunks).toHaveLength(1); expect(chunks[0]?.chunkIndex).toBe(0); expect(chunks[0]?.characterStart).toBe(0);
  });
  it('creates ordered overlapping chunks deterministically', () => {
    // Arrange
    const input = Array.from({ length: 40 }, (_, index) => `Sentence ${index} explains a useful support policy.`).join(' ');
    // Act
    const first = chunkText(input); const second = chunkText(input);
    // Assert
    expect(first.length).toBeGreaterThan(1); expect(first).toEqual(second); expect(first.map((chunk) => chunk.chunkIndex)).toEqual(first.map((_, index) => index)); expect(first[1]?.characterStart).toBeLessThan(first[0]?.characterEnd ?? 0); expect(first.every((chunk) => chunk.content.trim().length > 0)).toBe(true);
  });
  it('prefers paragraph boundaries and handles whitespace-only input', () => {
    // Arrange
    const input = `${'First paragraph content. '.repeat(18).trim()}\n\n${'Second paragraph content. '.repeat(18).trim()}`;
    // Act
    const chunks = chunkText(input, { targetCharacters: 300, overlapCharacters: 50 });
    // Assert
    expect(chunks.length).toBeGreaterThan(1); expect(chunks[0]?.content).toContain('First paragraph'); expect(chunkText('   \n\n ... !!! ')).toEqual([]); expect(CHUNKING.overlapCharacters).toBeLessThan(CHUNKING.targetCharacters);
  });
});
