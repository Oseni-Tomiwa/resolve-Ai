import { requestIdFrom } from './request-context';

describe('requestIdFrom', () => {
  it('preserves a valid request id', () => { expect(requestIdFrom({ headers: { 'x-request-id': 'client-123' } } as never)).toBe('client-123'); });
  it('replaces malformed and missing request ids', () => { const malformed = requestIdFrom({ headers: { 'x-request-id': 'bad value' } } as never); const missing = requestIdFrom({ headers: {} } as never); expect(malformed).toMatch(/^[0-9a-f-]{36}$/); expect(missing).toMatch(/^[0-9a-f-]{36}$/); });
});
