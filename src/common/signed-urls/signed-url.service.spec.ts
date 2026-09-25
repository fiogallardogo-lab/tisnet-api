import { describe, expect, it, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { SignedUrlService } from './signed-url.service';

describe('SignedUrlService', () => {
  let service: SignedUrlService;

  beforeEach(() => {
    const configMock = {
      get: (key: string) => {
        if (key === 'SIGNED_URL_SECRET') return 'test-super-secret-key-123';
        return null;
      },
    } as unknown as ConfigService;

    service = new SignedUrlService(configMock);
  });

  it('generates a signed token with expiration and validates successfully', () => {
    const { token, expiresAt, expiresInSeconds } = service.generateSignedToken(
      42,
      'cv',
      900,
    );

    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(2);
    expect(expiresInSeconds).toBe(900);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const result = service.verifyToken(token, 42, 'cv');
    expect(result.valid).toBe(true);
    expect(result.payload?.entityId).toBe(42);
    expect(result.payload?.fileType).toBe('cv');
  });

  it('rejects tampered tokens', () => {
    const { token } = service.generateSignedToken(42, 'cv', 900);
    const tampered = token.slice(0, -4) + 'abcd';

    const result = service.verifyToken(tampered, 42, 'cv');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('signature');
  });

  it('identifies expired tokens', () => {
    // Generate token with -10 seconds expiration (already expired)
    const { token } = service.generateSignedToken(42, 'cv', -10);

    const result = service.verifyToken(token, 42, 'cv');
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
    expect(result.error).toContain('expired');
  });

  it('rejects tokens requested for a different entity or fileType', () => {
    const { token } = service.generateSignedToken(42, 'cv', 900);

    // Mismatched entityId
    const wrongEntity = service.verifyToken(token, 999, 'cv');
    expect(wrongEntity.valid).toBe(false);
    expect(wrongEntity.error).toContain('scope');

    // Mismatched fileType
    const wrongType = service.verifyToken(token, 42, 'photo');
    expect(wrongType.valid).toBe(false);
    expect(wrongType.error).toContain('scope');
  });

  it('generates complete signed URLs correctly', () => {
    const { signedUrl, expiresAt } = service.generateSignedUrl(
      'https://api.tisnet.pe',
      10,
      'photo',
      600,
    );

    expect(signedUrl).toContain('https://api.tisnet.pe/api/v1/team-applications/10/secure-download');
    expect(signedUrl).toContain('fileType=photo');
    expect(signedUrl).toContain('token=');
    expect(expiresAt).toBeInstanceOf(Date);
  });
});
