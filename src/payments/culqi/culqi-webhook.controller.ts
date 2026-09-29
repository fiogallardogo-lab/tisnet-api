import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Headers,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CulqiWebhookService } from './culqi-webhook.service';
import { CulqiWebhookPayload } from './culqi-webhook.types';
import { timingSafeEqual } from 'crypto';

@ApiTags('Payments')
@Controller('payments/culqi')
export class CulqiWebhookController {
  private readonly logger = new Logger(CulqiWebhookController.name);

  constructor(
    private readonly webhookService: CulqiWebhookService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Culqi calls this endpoint asynchronously after each payment event.
   * Rate: 60 req / 60 s � enough headroom for bursts while limiting replay abuse.
   */
  @Post('webhook')
  @Throttle({ webhook: { ttl: 60000, limit: 60 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Receives and handles asynchronous events from Culqi payment gateway',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook acknowledged successfully',
  })
  async handleWebhook(
    @Body() payload: CulqiWebhookPayload,
    @Headers('authorization') authHeader?: string,
  ): Promise<{ received: boolean }> {
    const expectedAuth = this.configService.get<string>(
      'CULQI_WEBHOOK_BASIC_AUTH',
    );
    if (!expectedAuth?.trim()) {
      throw new ServiceUnavailableException(
        'Webhook de Culqi pendiente de configuración.',
      );
    }
    if (expectedAuth) {
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        throw new UnauthorizedException(
          'Missing or invalid authorization header',
        );
      }
      const expectedBuffer = Buffer.from(`Basic ${expectedAuth}`);
      const actualBuffer = Buffer.from(authHeader);

      if (
        expectedBuffer.length !== actualBuffer.length ||
        !timingSafeEqual(expectedBuffer, actualBuffer)
      ) {
        throw new UnauthorizedException('Invalid webhook signature/auth');
      }
    }

    this.logger.log(
      `[CulqiWebhookController] Received webhook event: ${payload?.type}`,
    );

    // Process asynchronously � respond immediately so Culqi does not retry on timeout
    await this.webhookService.processEvent(payload);

    return { received: true };
  }
}
