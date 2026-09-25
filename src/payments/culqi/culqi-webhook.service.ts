import { Injectable, Logger } from '@nestjs/common';
import { CulqiProcessedEvent, CulqiWebhookPayload } from './culqi-webhook.types';

@Injectable()
export class CulqiWebhookService {
  private readonly logger = new Logger(CulqiWebhookService.name);

  /**
   * Process Culqi webhook payload.
   * Designed to be idempotent and safe: never throws unhandled errors that
   * would cause Culqi to hammer the endpoint with retry loops.
   */
  async processEvent(payload: CulqiWebhookPayload): Promise<CulqiProcessedEvent> {
    this.logger.log(`[CulqiWebhook] Received event: type=${payload?.type}, object=${payload?.object}`);

    const eventType = payload?.type;
    const data = typeof payload?.data === 'string' ? JSON.parse(payload.data) : payload?.data ?? {};

    const baseEvent: CulqiProcessedEvent = {
      eventId: payload?.id,
      eventType,
      processedAt: new Date(),
      status: 'IGNORED',
    };

    try {
      switch (eventType) {
        case 'charge.creation.succeeded': {
          baseEvent.chargeId = data.id;
          baseEvent.amount = data.amount;
          baseEvent.currency = data.currency_code;
          baseEvent.customerEmail = data.email;
          baseEvent.metadata = data.metadata;
          baseEvent.status = 'SUCCEEDED';

          this.logger.log(
            `[CulqiWebhook] Payment SUCCEEDED: charge=${data.id}, amount=${data.amount} ${data.currency_code}, email=${data.email}`,
          );
          // TODO (Sprint 9/10): Update quote status or trigger project kickoff
          break;
        }

        case 'charge.creation.failed': {
          baseEvent.chargeId = data.id;
          baseEvent.amount = data.amount;
          baseEvent.currency = data.currency_code;
          baseEvent.customerEmail = data.email;
          baseEvent.metadata = data.metadata;
          baseEvent.status = 'FAILED';

          this.logger.warn(
            `[CulqiWebhook] Payment FAILED: charge=${data.id}, outcome=${data.outcome?.user_message}`,
          );
          break;
        }

        case 'order.status.changed': {
          baseEvent.orderId = data.id;
          baseEvent.amount = data.amount;
          baseEvent.currency = data.currency_code;
          baseEvent.metadata = data.metadata;
          baseEvent.status = data.state === 'paid' ? 'SUCCEEDED' : 'PENDING';

          this.logger.log(`[CulqiWebhook] Order status changed: order=${data.id}, state=${data.state}`);
          break;
        }

        default: {
          this.logger.log(`[CulqiWebhook] Unhandled event type "${eventType}", safely ignored.`);
          baseEvent.status = 'IGNORED';
          break;
        }
      }
    } catch (err: any) {
      this.logger.error(`[CulqiWebhook] Error processing event ${eventType}: ${err.message}`, err.stack);
      baseEvent.status = 'FAILED';
    }

    return baseEvent;
  }
}
