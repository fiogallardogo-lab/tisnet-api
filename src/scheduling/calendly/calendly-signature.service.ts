import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Validates Calendly webhook HMAC-SHA256 signatures.
 *
 * Calendly sends the signature in the 'Calendly-Webhook-Signature' header
 * as a comma-separated list of key=value pairs, e.g.:
 *   t=1234567890,v1=abcdef1234...
 *
 * The signed payload is: <timestamp>.<rawBody>
 * Reference: https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-webhook-data
 */
@Injectable()
export class CalendlySignatureService {
  private readonly logger = new Logger(CalendlySignatureService.name);

  /**
   * Verifies the Calendly-Webhook-Signature header against the raw request body.
   * Returns true if the signature is valid; false otherwise.
   * Never throws — failures are logged and treated as invalid.
   */
  verify(
    signingKey: string,
    signatureHeader: string | undefined,
    rawBody: Buffer,
  ): boolean {
    if (!signatureHeader) {
      this.logger.warn('[Calendly] Missing Calendly-Webhook-Signature header');
      return false;
    }

    const parts = this.parseParts(signatureHeader);
    const timestamp = parts.get('t');
    const receivedSig = parts.get('v1');

    if (!timestamp || !receivedSig) {
      this.logger.warn('[Calendly] Signature header missing t= or v1= parts');
      return false;
    }

    // Reject replays older than 5 minutes.
    const ts = parseInt(timestamp, 10);
    if (Number.isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
      this.logger.warn('[Calendly] Webhook timestamp outside tolerance window');
      return false;
    }

    const signedPayload = timestamp + '.' + rawBody.toString('utf8');
    const expected = createHmac('sha256', signingKey)
      .update(signedPayload)
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(receivedSig, 'hex'));
    } catch {
      // Buffers of different lengths — definitely invalid.
      return false;
    }
  }

  /** Parses 't=123,v1=abc' into Map { t => '123', v1 => 'abc' }. */
  private parseParts(header: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const part of header.split(',')) {
      const eq = part.indexOf('=');
      if (eq > 0) {
        map.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
      }
    }
    return map;
  }
}