import { createHmac } from 'node:crypto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { CalendlySignatureService } from './calendly-signature.service';

const SECRET = 'test-signing-key-12345';

function buildSignatureHeader(body: string, secret: string, offsetSeconds = 0): string {
  const ts = Math.floor(Date.now() / 1000) + offsetSeconds;
  const signed = ts + '.' + body;
  const sig = createHmac('sha256', secret).update(signed).digest('hex');
  return 't=' + ts + ',v1=' + sig;
}

describe('CalendlySignatureService', () => {
  let service: CalendlySignatureService;

  beforeEach(() => {
    service = new CalendlySignatureService();
  });

  it('returns true for a valid signature and fresh timestamp', () => {
    const body = '{"event":"invitee.created"}';
    const header = buildSignatureHeader(body, SECRET);
    expect(service.verify(SECRET, header, Buffer.from(body))).toBe(true);
  });

  it('returns false when the header is missing', () => {
    expect(service.verify(SECRET, undefined, Buffer.from('{}'))).toBe(false);
  });

  it('returns false when the header is empty', () => {
    expect(service.verify(SECRET, '', Buffer.from('{}'))).toBe(false);
  });

  it('returns false when the signature is tampered', () => {
    const body = '{"event":"invitee.created"}';
    const header = buildSignatureHeader(body, SECRET).replace(/v1=[a-f0-9]+/, 'v1=deadbeef');
    expect(service.verify(SECRET, header, Buffer.from(body))).toBe(false);
  });

  it('returns false when the body has been modified', () => {
    const body = '{"event":"invitee.created"}';
    const header = buildSignatureHeader(body, SECRET);
    expect(service.verify(SECRET, header, Buffer.from(body + 'MODIFIED'))).toBe(false);
  });

  it('returns false when the signing key is wrong', () => {
    const body = '{"event":"invitee.created"}';
    const header = buildSignatureHeader(body, SECRET);
    expect(service.verify('wrong-key', header, Buffer.from(body))).toBe(false);
  });

  it('returns false when the timestamp is older than 5 minutes', () => {
    const body = '{"event":"invitee.created"}';
    const header = buildSignatureHeader(body, SECRET, -310); // 310s in the past
    expect(service.verify(SECRET, header, Buffer.from(body))).toBe(false);
  });

  it('returns false when v1 or t part is missing from header', () => {
    expect(service.verify(SECRET, 'v1=abc123', Buffer.from('{}'))).toBe(false);
    expect(service.verify(SECRET, 't=99999999', Buffer.from('{}'))).toBe(false);
  });
});