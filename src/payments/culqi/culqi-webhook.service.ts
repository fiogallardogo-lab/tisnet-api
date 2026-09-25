import { Injectable, Logger, Optional } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { CulqiProcessedEvent, CulqiWebhookPayload } from './culqi-webhook.types';

@Injectable()
export class CulqiWebhookService {
  private readonly logger = new Logger(CulqiWebhookService.name);

  constructor(@Optional() private readonly auditService?: AuditService) {}

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
          await this.auditService?.logPaymentEvent({
            paymentId: data.id,
            amount: data.amount,
            currency: data.currency_code,
            status: 'SUCCEEDED',
            email: data.email,
            metadata: data.metadata,
          });
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
          await this.auditService?.logPaymentEvent({
            paymentId: data.id,
            amount: data.amount,
            currency: data.currency_code,
            status: 'FAILED',
            email: data.email,
            metadata: data.metadata,
          });
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
