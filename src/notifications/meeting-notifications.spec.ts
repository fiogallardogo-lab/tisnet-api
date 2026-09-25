import { describe, expect, it } from 'vitest';
import {
  renderMeetingConfirmed,
  renderMeetingCancelled,
  renderMeetingRescheduled,
} from './templates/meeting-notifications';

const BASE = {
  recipient: 'cliente@example.com',
  attendeeName: 'Carlos Paredes',
  advisorName: 'Fiorella Gallardo',
  startIso: '2026-10-15T15:00:00.000Z',
  endIso: '2026-10-15T15:30:00.000Z',
  meetingUrl: 'https://meet.jit.si/tisnet-session-abc123',
};

describe('Meeting notification templates', () => {
  // ─── renderMeetingConfirmed ─────────────────────────────────────────────
  describe('renderMeetingConfirmed()', () => {
    it('returns a message with correct subject and metadata', () => {
      const msg = renderMeetingConfirmed({ ...BASE, type: 'MEETING_CONFIRMED' });
      expect(msg.recipient).toBe(BASE.recipient);
      expect(msg.subject).toContain('Fiorella Gallardo');
      expect(msg.metadata.type).toBe('MEETING_CONFIRMED');
      expect(msg.metadata.meetingUrl).toBe(BASE.meetingUrl);
    });

    it('includes the meeting URL in both text and html', () => {
      const msg = renderMeetingConfirmed({ ...BASE, type: 'MEETING_CONFIRMED' });
      expect(msg.text).toContain(BASE.meetingUrl);
      expect(msg.html).toContain(BASE.meetingUrl);
    });

    it('includes the quoteCode when provided', () => {
      const msg = renderMeetingConfirmed({
        ...BASE, type: 'MEETING_CONFIRMED', quoteCode: 'Q-00000001',
      });
      expect(msg.text).toContain('Q-00000001');
      expect(msg.html).toContain('Q-00000001');
    });

    it('throws on invalid recipient email', () => {
      expect(() =>
        renderMeetingConfirmed({ ...BASE, type: 'MEETING_CONFIRMED', recipient: 'not-an-email' }),
      ).toThrow('Invalid meeting notification recipient');
    });

    it('throws on invalid meeting URL', () => {
      expect(() =>
        renderMeetingConfirmed({ ...BASE, type: 'MEETING_CONFIRMED', meetingUrl: 'not-a-url' }),
      ).toThrow('Invalid meetingUrl');
    });

    it('escapes HTML special chars in attendeeName', () => {
      const msg = renderMeetingConfirmed({
        ...BASE, type: 'MEETING_CONFIRMED',
        attendeeName: '<script>alert(1)</script>',
      });
      expect(msg.html).not.toContain('<script>');
      expect(msg.html).toContain('&lt;script&gt;');
    });
  });

  // ─── renderMeetingCancelled ──────────────────────────────────────────────
  describe('renderMeetingCancelled()', () => {
    it('returns a cancelled message with correct metadata', () => {
      const msg = renderMeetingCancelled({ ...BASE, type: 'MEETING_CANCELLED' });
      expect(msg.subject).toContain('cancelada');
      expect(msg.metadata.type).toBe('MEETING_CANCELLED');
    });

    it('includes the cancellation reason when provided', () => {
      const msg = renderMeetingCancelled({
        ...BASE, type: 'MEETING_CANCELLED', cancellationReason: 'Emergencia personal',
      });
      expect(msg.text).toContain('Emergencia personal');
      expect(msg.html).toContain('Emergencia personal');
    });

    it('omits the reason section when no reason is given', () => {
      const msg = renderMeetingCancelled({ ...BASE, type: 'MEETING_CANCELLED' });
      expect(msg.text).not.toContain('Motivo:');
    });
  });

  // ─── renderMeetingRescheduled ────────────────────────────────────────────
  describe('renderMeetingRescheduled()', () => {
    it('includes both old and new dates', () => {
      const msg = renderMeetingRescheduled({
        ...BASE,
        type: 'MEETING_RESCHEDULED',
        previousStartIso: '2026-10-10T10:00:00.000Z',
      });
      expect(msg.subject).toContain('reprogramada');
      expect(msg.text).toContain('Fecha anterior');
      expect(msg.text).toContain('Nueva fecha');
      expect(msg.metadata.type).toBe('MEETING_RESCHEDULED');
    });

    it('throws on invalid previousStartIso', () => {
      expect(() =>
        renderMeetingRescheduled({
          ...BASE, type: 'MEETING_RESCHEDULED', previousStartIso: 'not-a-date',
        }),
      ).toThrow('Invalid ISO date');
    });
  });
});