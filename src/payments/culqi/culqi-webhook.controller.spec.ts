import { CulqiWebhookController } from './culqi-webhook.controller';
import { CulqiWebhookService } from './culqi-webhook.service';
import { vi } from 'vitest';

describe('CulqiWebhookController', () => {
  let controller: CulqiWebhookController;
  let service: CulqiWebhookService;

  beforeEach(() => {
    service = {
      processEvent: vi.fn().mockResolvedValue({ status: 'SUCCEEDED' }),
    } as unknown as CulqiWebhookService;
    controller = new CulqiWebhookController(service, {
      get: () => 'test-secret',
    } as any);
  });

  it('acknowledges a valid webhook after processing', async () => {
    const payload = {
      object: 'event',
      type: 'charge.creation.succeeded' as const,
      data: { id: 'chr_123', amount: 5000 },
    };

    const response = await controller.handleWebhook(
      payload,
      'Basic test-secret',
    );
    expect(response).toEqual({ received: true });
    expect(service.processEvent).toHaveBeenCalledWith(payload);
  });
  it('propagates persistence failures instead of acknowledging lost payments', async () => {
    vi.mocked(service.processEvent).mockRejectedValue(
      new Error('Database unavailable'),
    );
    await expect(
      controller.handleWebhook(
        { object: 'event', type: 'charge.creation.succeeded', data: {} },
        'Basic test-secret',
      ),
    ).rejects.toThrow('Database unavailable');
  });
});
