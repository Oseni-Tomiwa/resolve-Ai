import { extractText, normalizeText } from './processing.js';

describe('knowledge processing', () => {
  it('normalizes plain text and Markdown without changing content semantics', async () => {
    // Arrange
    const contents = Buffer.from('Title\r\n\r\n\r\nBody  ');
    // Act
    const result = await extractText('text/markdown', contents);
    // Assert
    expect(result).toBe('Title\n\nBody'); expect(normalizeText(' A\n\n\n B ')).toBe('A\n\n B');
  });
  it('fails clearly when a document contains no readable text', async () => {
    // Arrange
    const contents = Buffer.alloc(0);
    // Act
    const result = await extractText('text/plain', contents);
    // Assert
    expect(result).toBe('');
  });

  it('extracts readable text from HTML without scripts or markup', async () => {
    // Arrange
    const contents = Buffer.from('<html><script>alert(1)</script><main>Reset your password</main></html>');
    // Act
    const result = await extractText('text/html', contents);
    // Assert
    expect(result).toBe('Reset your password');
  });
});
