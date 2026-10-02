import { CulqiWebhookService } from './culqi-webhook.service';
import { PaymentsService } from '../payments.service';
import { ConflictException } from '@nestjs/common';
import { vi } from 'vitest';

describe('CulqiWebhookService', () => {
  let service: CulqiWebhookService;
  const processEvent = vi.fn();

  beforeEach(() => {
    processEvent.mockReset().mockResolvedValue({ id: 1 });
    service = new CulqiWebhookService({
      processEvent,
    } as unknown as PaymentsService);
  });

  it('should process charge.creation.succeeded event', async () => {
    const payload = {
      object: 'event',
      type: 'charge.creation.succeeded' as const,
      id: 'evt_test_123',
      data: {
        id: 'chr_test_456',
        amount: 15000,
        currency_code: 'PEN',
        email: 'customer@example.com',
        outcome: { type: 'venta_exitosa' },
        metadata: { scheduleId: '1' },
      },
    };

    const result = await service.processEvent(payload);

    expect(result.status).toBe('SUCCEEDED');
    expect(result.chargeId).toBe('chr_test_456');
    expect(result.amount).toBe(15000);
    expect(result.currency).toBe('PEN');
    expect(processEvent).toHaveBeenCalledOnce();
  });

  it('should process charge.creation.failed event', async () => {
    const payload = {
      object: 'event',
      type: 'charge.creation.failed' as const,
      id: 'evt_test_failed',
      data: {
        id: 'chr_test_fail_1',
        amount: 20000,
        currency_code: 'PEN',
        email: 'failed@example.com',
        outcome: { user_message: 'Tarjeta expirada' },
        metadata: { scheduleId: '1' },
      },
    };

    const result = await service.processEvent(payload);

    expect(result.status).toBe('FAILED');
    expect(result.chargeId).toBe('chr_test_fail_1');
  });

  it('should safely ignore unhandled event types without throwing', async () => {
    const payload = {
      object: 'event',
      type: 'unhandled.unknown.event' as any,
      data: {},
    };

    const result = await service.processEvent(payload);
    expect(result.status).toBe('IGNORED');
  });
  it('does not turn business conflicts into successful payments', async () => {
    processEvent.mockRejectedValue(new ConflictException('Importe diferente'));
    await expect(
      service.processEvent({
        type: 'charge.creation.succeeded',
        object: 'event',
        data: {
          id: 'charge-1',
          amount: 100,
          currency_code: 'PEN',
          metadata: { scheduleId: '1' },
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects malformed JSON and missing schedule metadata', async () => {
    await expect(
      service.processEvent({
        type: 'charge.creation.succeeded',
        object: 'event',
        data: '{' as any,
      }),
    ).rejects.toThrow();
    await expect(
      service.processEvent({
        type: 'charge.creation.succeeded',
        object: 'event',
        data: { id: 'charge-1', amount: 100, currency_code: 'PEN' },
      }),
    ).rejects.toThrow();
    expect(processEvent).not.toHaveBeenCalled();
  });
});
