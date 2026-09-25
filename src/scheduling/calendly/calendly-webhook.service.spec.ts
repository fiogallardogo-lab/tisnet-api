import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CalendlyWebhookService } from './calendly-webhook.service';
import { FakeNotificationProvider } from '../../notifications/fake-notification.provider';
import type { CalendlyWebhookPayload } from './calendly-webhook.types';

function buildPayload(overrides: Partial<CalendlyWebhookPayload> = {}): CalendlyWebhookPayload {
  return {
    event: 'invitee.created',
    created_at: '2026-10-15T14:00:00.000Z',
    payload: {
      event: 'https://api.calendly.com/scheduled_events/EVT-001',
      event_type: 'https://api.calendly.com/event_types/ET-001',
      invitee: {
        uri: 'https://api.calendly.com/scheduled_events/EVT-001/invitees/INV-001',
        email: 'cliente@example.com',
        name: 'Carlos Paredes',
        status: 'active',
        created_at: '2026-10-15T14:00:00.000Z',
        updated_at: '2026-10-15T14:00:00.000Z',
      },
      scheduled_event: {
        uri: 'https://api.calendly.com/scheduled_events/EVT-001',
        name: 'Consulta comercial TISNET',
        status: 'active',
        start_time: '2026-10-15T15:00:00.000Z',
        end_time: '2026-10-15T15:30:00.000Z',
        location: { type: 'googlemeet', join_url: 'https://meet.google.com/abc-defg-hij' },
      },
      tracking: { utm_content: 'advisor-uuid-123', utm_term: 'Q-00000001' },
    },
    ...overrides,
  };
}

describe('CalendlyWebhookService', () => {
  let service: CalendlyWebhookService;
  let fakeProvider: FakeNotificationProvider;

  beforeEach(() => {
    fakeProvider = new FakeNotificationProvider();
    service = new CalendlyWebhookService(fakeProvider);
  });

  it('sends a confirmation email on invitee.created', async () => {
    await service.process(buildPayload());
    expect(fakeProvider.sentNotifications).toHaveLength(1);
    const sent = fakeProvider.sentNotifications[0];
    expect(sent.recipient).toBe('cliente@example.com');
    expect(sent.metadata?.type).toBe('MEETING_CONFIRMED');
  });

  it('sends a cancellation email on invitee.canceled', async () => {
    await service.process(buildPayload({
      event: 'invitee.canceled',
      payload: {
        ...buildPayload().payload,
        invitee: {
          ...buildPayload().payload.invitee,
          status: 'canceled',
          cancellation: { canceled_by: 'Carlos Paredes', reason: 'No puedo asistir', canceler_type: 'invitee' },
        },
      },
    }));
    expect(fakeProvider.sentNotifications).toHaveLength(1);
    expect(fakeProvider.sentNotifications[0].metadata?.type).toBe('MEETING_CANCELLED');
  });

  it('does not send email for invitee_no_show', async () => {
    await service.process(buildPayload({ event: 'invitee_no_show.created' }));
    expect(fakeProvider.sentNotifications).toHaveLength(0);
  });

  it('does not throw when notification delivery fails', async () => {
    fakeProvider.simulateFailure(true);
    await expect(service.process(buildPayload())).resolves.toBeUndefined();
  });

  it('skips processing when payload is incomplete', async () => {
    const badPayload = { ...buildPayload() };
    // @ts-expect-error intentionally corrupt
    delete badPayload.payload.scheduled_event.start_time;
    await service.process(badPayload);
    expect(fakeProvider.sentNotifications).toHaveLength(0);
  });
});