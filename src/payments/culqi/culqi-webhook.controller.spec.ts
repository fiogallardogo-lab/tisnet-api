import { CulqiWebhookController } from './culqi-webhook.controller';
import { CulqiWebhookService } from './culqi-webhook.service';

describe('CulqiWebhookController', () => {
  let controller: CulqiWebhookController;
  let service: CulqiWebhookService;

  beforeEach(() => {
    service = new CulqiWebhookService();
    controller = new CulqiWebhookController(service);
  });

  it('should return { received: true } immediately on valid webhook', async () => {
    const payload = {
      object: 'event',
      type: 'charge.creation.succeeded' as const,
      data: { id: 'chr_123', amount: 5000 },
    };

    const response = await controller.handleWebhook(payload);
    expect(response).toEqual({ received: true });
  });
});
