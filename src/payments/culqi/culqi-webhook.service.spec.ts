import { CulqiWebhookService } from './culqi-webhook.service';

describe('CulqiWebhookService', () => {
  let service: CulqiWebhookService;

  beforeEach(() => {
    service = new CulqiWebhookService();
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
      },
    };

    const result = await service.processEvent(payload);

    expect(result.status).toBe('SUCCEEDED');
    expect(result.chargeId).toBe('chr_test_456');
    expect(result.amount).toBe(15000);
    expect(result.currency).toBe('PEN');
    expect(result.customerEmail).toBe('customer@example.com');
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
});
