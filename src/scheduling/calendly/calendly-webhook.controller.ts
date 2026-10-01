import { CalendlyPersistenceService } from './calendly-persistence.service';
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
  ServiceUnavailableException,
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
    private readonly persistence: CalendlyPersistenceService,
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
      throw new ServiceUnavailableException('Calendly webhook no configurado');
    } else {
      const rawBody = req.rawBody;
      if (!rawBody) {
        throw new BadRequestException(
          'Raw body not available; check rawBody: true in NestJS bootstrap',
        );
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

    this.logger.log('[Calendly] Received scheduling event');

    // Acknowledge only after persistence so provider retries processing failures.
    const result = await this.persistence.process(body);
    if (result.fresh) await this.webhook.process(result.payload);

    return { received: true };
  }
}
