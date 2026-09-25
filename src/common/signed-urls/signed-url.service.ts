import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface SignedUrlPayload {
  entityId: string | number;
  fileType: 'cv' | 'photo';
  expiresAt: number; // Unix timestamp in ms
  nonce: string;
}

export interface VerificationResult {
  valid: boolean;
  expired?: boolean;
  payload?: SignedUrlPayload;
  error?: string;
}

@Injectable()
export class SignedUrlService {
  private readonly logger = new Logger(SignedUrlService.name);
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret =
      this.configService.get<string>('SIGNED_URL_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      'tisnet-default-secure-signed-url-secret-2026';
  }

  /**
   * Generates a signed token valid for `expiresInSeconds` (default 15 minutes / 900s).
   */
  generateSignedToken(
    entityId: string | number,
    fileType: 'cv' | 'photo',
    expiresInSeconds = 900,
  ): { token: string; expiresAt: Date; expiresInSeconds: number } {
    const expiresAtMs = Date.now() + expiresInSeconds * 1000;
    const payload: SignedUrlPayload = {
      entityId,
      fileType,
      expiresAt: expiresAtMs,
      nonce: crypto.randomBytes(8).toString('hex'),
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(payloadBase64);
    const token = `${payloadBase64}.${signature}`;

    return {
      token,
      expiresAt: new Date(expiresAtMs),
      expiresInSeconds,
    };
  }

  /**
   * Generates a full signed URL.
   */
  generateSignedUrl(
    baseUrl: string,
    entityId: string | number,
    fileType: 'cv' | 'photo',
    expiresInSeconds = 900,
  ): { signedUrl: string; expiresAt: Date } {
    const { token, expiresAt } = this.generateSignedToken(
      entityId,
      fileType,
      expiresInSeconds,
    );

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const signedUrl = `${cleanBase}/api/v1/team-applications/${entityId}/secure-download?token=${token}&fileType=${fileType}`;

    return { signedUrl, expiresAt };
  }

  /**
   * Verifies a signed token against expected entityId and fileType.
   */
  verifyToken(
    token: string,
    expectedEntityId: string | number,
    expectedFileType: 'cv' | 'photo',
  ): VerificationResult {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token is missing' };
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Malformed token structure' };
    }

    const [payloadBase64, providedSig] = parts;
    const expectedSig = this.sign(payloadBase64);

    // Constant-time signature comparison to prevent timing attacks
    const providedBuf = Buffer.from(providedSig);
    const expectedBuf = Buffer.from(expectedSig);

    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return { valid: false, error: 'Invalid token signature' };
    }

    let payload: SignedUrlPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    } catch {
      return { valid: false, error: 'Invalid payload JSON' };
    }

    // Expiration check
    if (Date.now() > payload.expiresAt) {
      return { valid: false, expired: true, error: 'Token has expired', payload };
    }

    // Scope check
    if (
      String(payload.entityId) !== String(expectedEntityId) ||
      payload.fileType !== expectedFileType
    ) {
      return { valid: false, error: 'Token scope does not match requested file', payload };
    }

    return { valid: true, payload };
  }

  private sign(data: string): string {
    return crypto.createHmac('sha256', this.secret).update(data).digest('base64url');
  }
}
