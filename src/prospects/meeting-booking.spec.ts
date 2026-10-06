import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MeetingPersistenceService } from './meeting-persistence.service';
import { FakeWhatsAppNotificationProvider } from '../notifications/fake-whatsapp-notification.provider';
import type { SchedulingProvider } from '../scheduling/scheduling-provider.interface';
import type { CommercialMailService } from '../commercial/commercial-mail.service';

describe('MeetingPersistenceService - Booking with Calendar & WhatsApp', () => {
  let service: MeetingPersistenceService;
  let fakeWhatsApp: FakeWhatsAppNotificationProvider;
  let mockPrisma: any;
  let mockMail: Partial<CommercialMailService>;
  let mockScheduling: Partial<SchedulingProvider>;

  beforeEach(() => {
    fakeWhatsApp = new FakeWhatsAppNotificationProvider();

    mockMail = {
      meeting: vi.fn().mockResolvedValue(undefined),
    };

    mockScheduling = {
      getAvailability: vi.fn(),
      createMeeting: vi.fn(),
    };

    mockPrisma = {
      $transaction: vi.fn(async (cb) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          adminProfile: {
            findFirst: vi.fn().mockResolvedValue({
              id: 10,
              executiveTitle: 'Asesor Comercial Senior',
              specialty: 'Desarrollo Web & Cloud',
              user: { id: 5, name: 'Oliver Asesor', email: 'oliver@tisnet.pe' },
            }),
          },
          quote: {
            findFirst: vi.fn().mockResolvedValue({
              id: 99,
              publicCode: 'COT-8899',
              prospectId: 101,
              contactEmail: 'cliente@ejemplo.com',
            }),
          },
          prospect: {
            update: vi.fn().mockResolvedValue({ id: 101 }),
          },
          meeting: {
            findFirst: vi.fn().mockResolvedValue(null), // no overlap
            create: vi.fn().mockResolvedValue({
              id: 501,
              createdAt: new Date(),
              timezone: 'America/Lima',
              status: 'PENDING',
              scheduledAt: new Date(Date.now() + 86400000 * 2), // 2 days later
              endsAt: new Date(Date.now() + 86400000 * 2 + 3600000),
            }),
          },
        };
        return cb(tx);
      }),
    };

    service = new MeetingPersistenceService(
      mockPrisma as any,
      mockScheduling as any,
      mockMail as any,
      fakeWhatsApp,
    );
  });

  it('rejects booking if notifyWhatsapp is true but phone is missing', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 2);
    const endDate = new Date(futureDate.getTime() + 3600000);

    await expect(
      service.book({
        advisorId: 10,
        name: 'Carlos Cliente',
        email: 'cliente@ejemplo.com',
        quoteId: 'COT-8899',
        start: futureDate.toISOString(),
        end: endDate.toISOString(),
        notifyWhatsapp: true,
        phone: '', // empty phone
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('successfully books meeting, generates calendar links, and triggers WhatsApp confirmation', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 2);
    const endDate = new Date(futureDate.getTime() + 3600000);

    const result = await service.book({
      advisorId: 10,
      name: 'Carlos Cliente',
      email: 'cliente@ejemplo.com',
      quoteId: 'COT-8899',
      start: futureDate.toISOString(),
      end: endDate.toISOString(),
      phone: '+51987654321',
      notifyWhatsapp: true,
    });

    // 1. Verify returned properties for UI confirmation modal
    expect(result.id).toBe(501);
    expect(result.quoteId).toBe('COT-8899');
    expect(result.advisor.name).toBe('Oliver Asesor');
    expect(result.meetingUrl).toContain('/meetings/501');
    expect(result.calendarLinks.googleCalendarUrl).toContain('calendar.google.com');
    expect(result.calendarLinks.outlookUrl).toContain('outlook.live.com');
    expect(result.notifications.email).toBe('cliente@ejemplo.com');
    expect(result.notifications.whatsapp).toBe('+51987654321');

    // 2. Verify mail was triggered
    expect(mockMail.meeting).toHaveBeenCalledWith(501);

    // 3. Verify WhatsApp notification was sent
    expect(fakeWhatsApp.sentMessages).toHaveLength(1);
    expect(fakeWhatsApp.sentMessages[0].recipientPhone).toBe('+51987654321');
    expect(fakeWhatsApp.sentMessages[0].message).toContain('Oliver Asesor');
    expect(fakeWhatsApp.sentMessages[0].message).toContain('COT-8899');
    expect(fakeWhatsApp.sentMessages[0].message).toContain(result.meetingUrl);
  });

  it('books meeting without WhatsApp when notifyWhatsapp is false', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 2);
    const endDate = new Date(futureDate.getTime() + 3600000);

    const result = await service.book({
      advisorId: 10,
      name: 'Carlos Cliente',
      email: 'cliente@ejemplo.com',
      quoteId: 'COT-8899',
      start: futureDate.toISOString(),
      end: endDate.toISOString(),
      phone: '+51987654321',
      notifyWhatsapp: false,
    });

    expect(result.notifications.whatsapp).toBeNull();
    expect(fakeWhatsApp.sentMessages).toHaveLength(0);
    expect(mockMail.meeting).toHaveBeenCalledWith(501);
  });
});
