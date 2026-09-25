import { describe, it, expect } from 'vitest';
import { safeAuditMetadata, csvCell } from './audit.service';
describe('Safe audit metadata', () => {
  it('never persists passwords, tokens, nested payloads or arbitrary strings', () => {
    expect(
      safeAuditMetadata({
        password: 'secret',
        passwordHash: 'hash',
        token: 'token',
        authorization: 'Bearer',
        metadata: { secret: 'hidden' },
        status: 'CONFIRMED',
        version: 2,
        method: 'POST',
      }),
    ).toEqual({ status: 'CONFIRMED', version: 2, method: 'POST' });
  });
  it('blocks CSV formula execution and quotes delimiters', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell('a,"b')).toBe('"a,""b"');
  });
});
