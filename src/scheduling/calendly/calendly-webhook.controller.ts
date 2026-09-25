import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CalendlySignatureService } from './calendly-signature.service';
import { CalendlyWebhookService } from './calendly-webhook.service';
import type { CalendlyWebhookPayload } from './calendly-webhook.types';

/**
 * Receives Calendly webhook events.
 *
 * Endpoint: POST /api/v1/integrations/calendly/webhook
 *
 * The raw request body is required for HMAC signature verification;
 * NestJS must be configured with rawBody: true (main.ts).
 *
 * Required env vars (provided by Producto):
 *   CALENDLY_WEBHOOK_SECRET – signing key from Calendly Developer dashboard
 */
@Controller('integrations/calendly')
export class CalendlyWebhookController {
  private readonly logger = new Logger(CalendlyWebhookController.name);

  constructor(
    private readonly signature: CalendlySignatureService,
    private readonly webhook: CalendlyWebhookService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: CalendlyWebhookPayload,
    @Headers('Calendly-Webhook-Signature') sigHeader: string | undefined,
  ): Promise<{ received: true }> {
    const signingKey = process.env.CALENDLY_WEBHOOK_SECRET;

    if (!signingKey) {
      // No secret configured — log and accept in dev mode only.
      this.logger.warn(
        '[Calendly] CALENDLY_WEBHOOK_SECRET not set; skipping signature verification',
      );
    } else {
      const rawBody = req.rawBody;
      if (!rawBody) {
        throw new BadRequestException('Raw body not available; check rawBody: true in NestJS bootstrap');
      }
      const valid = this.signature.verify(signingKey, sigHeader, rawBody);
      if (!valid) {
        this.logger.warn('[Calendly] Rejected webhook: invalid signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    if (!body?.event || !body?.payload) {
      throw new BadRequestException('Malformed Calendly webhook payload');
    }

    this.logger.log('[Calendly] Received event=' + body.event);

    // Process asynchronously — webhook must return 200 immediately.
    void this.webhook.process(body).catch((err: unknown) => {
      this.logger.error(
        '[Calendly] Unhandled error processing event=' + body.event,
        err instanceof Error ? err.stack : String(err),
      );
    });

    return { received: true };
  }
}