import {
  BadRequestException,
  Injectable,
  forwardRef,
  Inject,
} from '@nestjs/common';
import {
  CulqiProcessedEvent,
  CulqiWebhookPayload,
} from './culqi-webhook.types';
import { PaymentsService } from '../payments.service';

@Injectable()
export class CulqiWebhookService {
  constructor(
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  async processEvent(
    payload: CulqiWebhookPayload,
  ): Promise<CulqiProcessedEvent> {
    const event: CulqiProcessedEvent = {
      eventId: payload?.id,
      eventType: payload?.type,
      processedAt: new Date(),
      status: 'IGNORED',
    };
    if (
      ![
        'charge.creation.succeeded',
        'charge.creation.failed',
        'order.status.changed',
      ].includes(payload?.type)
    )
      return event;
    let data: Exclude<CulqiWebhookPayload['data'], string>;
    try {
      data =
        typeof payload.data === 'string'
          ? JSON.parse(payload.data)
          : payload.data;
    } catch {
      throw new BadRequestException('Payload de pago inválido.');
    }
    if (!data || typeof data !== 'object')
      throw new BadRequestException('Datos de pago requeridos.');
    const order = payload.type === 'order.status.changed';
    if (order && !['paid', 'expired'].includes(data.state ?? ''))
      return { ...event, status: 'PENDING' };
    const scheduleId = Number(data.metadata?.scheduleId);
    const amountMinor = Number(data.amount);
    if (
      !Number.isSafeInteger(scheduleId) ||
      scheduleId < 1 ||
      !Number.isSafeInteger(amountMinor) ||
      amountMinor < 1 ||
      typeof data.id !== 'string' ||
      !data.id.trim() ||
      typeof data.currency_code !== 'string' ||
      !data.currency_code.trim()
    )
      throw new BadRequestException(
        'El evento requiere cuota, identificador, importe y moneda válidos.',
      );
    const confirmed = order
      ? data.state === 'paid'
      : payload.type === 'charge.creation.succeeded';
    // Exact replays are handled in the transaction; conflicts must remain errors.
    await this.paymentsService.processEvent({
      scheduleId,
      externalEventId: data.id,
      amountMinor,
      currency: data.currency_code,
      status: confirmed ? 'CONFIRMED' : 'FAILED',
    });
    return {
      ...event,
      status: confirmed ? 'SUCCEEDED' : 'FAILED',
      ...(order ? { orderId: data.id } : { chargeId: data.id }),
      amount: amountMinor,
      currency: data.currency_code,
    };
  }
}
