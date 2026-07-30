import { corsAllowedHeaders, isAllowedCorsOrigin } from './cors';

describe('CORS policy', () => {
  it('accepts the local web origin when configured', () => {
    // Arrange / Act / Assert
    expect(isAllowedCorsOrigin('http://localhost:3000', 'http://localhost:3000')).toBe(true);
  });

  it('rejects an unapproved origin for authenticated API requests', () => {
    // Arrange / Act / Assert
    expect(isAllowedCorsOrigin('https://attacker.example', 'https://app.example.com')).toBe(false);
  });

  it('does not use wildcard origins with credentials', () => {
    // Arrange / Act / Assert
    expect(isAllowedCorsOrigin('https://app.example.com', '*')).toBe(false);
  });

  it('allows the request ID header used by the centralized web client', () => {
    // Arrange / Act / Assert
    expect(corsAllowedHeaders).toContain('X-Request-Id');
  });
});
