import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleCalendarProvider } from './google-calendar.provider';
import { SlotUnavailableError } from '../scheduling-provider.interface';

vi.mock('googleapis', () => {
  const insertMock = vi.fn().mockResolvedValue({
    data: {
      id: 'mock-event-123',
      hangoutLink: 'https://meet.google.com/abc-defg-hij',
      htmlLink: 'https://calendar.google.com/event?eid=mock',
    },
  });

  const queryMock = vi.fn().mockResolvedValue({
    data: {
      calendars: {
        'primary': {
          busy: [
            {
              start: '2026-10-10T10:00:00.000Z',
              end: '2026-10-10T11:00:00.000Z',
            },
          ],
        },
      },
    },
  });

  class MockOAuth2 {
    generateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock=true');
    getToken = vi.fn().mockResolvedValue({
      tokens: { refresh_token: 'mock-refresh-token-xyz' },
    });
    setCredentials = vi.fn();
  }

  return {
    google: {
      auth: {
        OAuth2: MockOAuth2,
      },
      calendar: vi.fn().mockReturnValue({
        events: {
          insert: insertMock,
        },
        freebusy: {
          query: queryMock,
        },
      }),
    },
  };
});

describe('GoogleCalendarService and Provider', () => {
  let service: GoogleCalendarService;
  let provider: GoogleCalendarProvider;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'mock-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'mock-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/v1/integrations/google/callback';
    process.env.GOOGLE_CALENDAR_ID = 'primary';
    delete process.env.GOOGLE_REFRESH_TOKEN;

    service = new GoogleCalendarService();
    provider = new GoogleCalendarProvider(service);
  });

  it('detecta correctamente si está configurado', () => {
    expect(service.isConfigured()).toBe(true);

    delete process.env.GOOGLE_CLIENT_ID;
    const unconfigured = new GoogleCalendarService();
    expect(unconfigured.isConfigured()).toBe(false);
  });

  it('genera URL de autorización OAuth2 con scopes requeridos', () => {
    const url = service.generateAuthUrl();
    expect(url).toContain('https://accounts.google.com');
  });

  it('guarda el refresh token al procesar el callback', async () => {
    const result = await service.handleCallback('mock-code-123');
    expect(result.success).toBe(true);
    expect(result.refreshToken).toBe('mock-refresh-token-xyz');
    expect(service.isAuthorized()).toBe(true);
  });

  it('valida que la fecha de fin sea posterior al inicio', async () => {
    service.setRefreshToken('mock-token');

    await expect(
      provider.createMeeting({
        advisorId: '1',
        attendeeName: 'Cliente Test',
        attendeeEmail: 'cliente@test.com',
        start: new Date('2026-10-10T11:00:00.000Z'),
        end: new Date('2026-10-10T10:00:00.000Z'),
      }),
    ).rejects.toThrow(SlotUnavailableError);
  });

  it('crea una reunión exitosamente con enlace de Google Meet', async () => {
    service.setRefreshToken('mock-token');

    const result = await provider.createMeeting({
      advisorId: '1',
      attendeeName: 'Carlos López',
      attendeeEmail: 'carlos@cliente.pe',
      start: new Date('2026-10-10T10:00:00.000Z'),
      end: new Date('2026-10-10T11:00:00.000Z'),
      quoteId: 'COT-2026-001',
    });

    expect(result.meetingId).toBe('mock-event-123');
    expect(result.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(result.attendeeName).toBe('Carlos López');
    expect(result.attendeeEmail).toBe('carlos@cliente.pe');
  });

  it('obtiene la disponibilidad y mapea slots ocupados', async () => {
    service.setRefreshToken('mock-token');

    const result = await provider.getAvailability({
      advisorId: '1',
      from: new Date('2026-10-10T08:00:00.000Z'),
      to: new Date('2026-10-10T18:00:00.000Z'),
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('BUSY');
    expect(result[0].start.toISOString()).toBe('2026-10-10T10:00:00.000Z');
    expect(result[0].end.toISOString()).toBe('2026-10-10T11:00:00.000Z');
  });
});
