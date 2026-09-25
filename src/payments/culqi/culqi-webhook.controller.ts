import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CulqiWebhookService } from './culqi-webhook.service';
import { CulqiWebhookPayload } from './culqi-webhook.types';

@ApiTags('Payments')
@Controller('payments/culqi')
export class CulqiWebhookController {
  private readonly logger = new Logger(CulqiWebhookController.name);

  constructor(private readonly webhookService: CulqiWebhookService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receives and handles asynchronous events from Culqi payment gateway',
  })
  @ApiResponse({ status: 200, description: 'Webhook acknowledged successfully' })
  async handleWebhook(@Body() payload: CulqiWebhookPayload): Promise<{ received: boolean }> {
    this.logger.log(`[CulqiWebhookController] Received webhook event: ${payload?.type}`);

    // Process asynchronously without blocking response to avoid timeouts
    void this.webhookService.processEvent(payload).catch((err) => {
      this.logger.error(`Async webhook processing failed: ${err.message}`);
    });

    return { received: true };
  }
}
