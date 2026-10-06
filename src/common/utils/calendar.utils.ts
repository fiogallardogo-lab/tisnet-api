export interface CalendarEventData {
  title: string;
  description: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
  url?: string;
}

export interface CalendarLinks {
  googleCalendarUrl: string;
  outlookUrl: string;
  office365Url: string;
  icsContent: string;
}

export class CalendarUtils {
  /**
   * Generates a standard RFC-5545 iCalendar (.ics) string.
   */
  static generateIcs(event: CalendarEventData): string {
    const formatDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const escapeIcsText = (text: string): string => {
      return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
    };

    const startFormatted = formatDate(event.startTime);
    const endFormatted = formatDate(event.endTime);
    const nowFormatted = formatDate(new Date());
    const uid = `meeting-${event.startTime.getTime()}-${Math.random().toString(36).substring(2, 9)}@tisnet.pe`;

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TISNET Soluciones Digitales//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowFormatted}`,
      `DTSTART:${startFormatted}`,
      `DTEND:${endFormatted}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(event.description)}`,
      event.location ? `LOCATION:${escapeIcsText(event.location)}` : '',
      event.url ? `URL:${event.url}` : '',
      `ORGANIZER;CN=${escapeIcsText(event.organizerName)}:mailto:${event.organizerEmail}`,
      `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${escapeIcsText(event.attendeeName)}:mailto:${event.attendeeEmail}`,
      'STATUS:CONFIRMED',
      // Recordatorio 15 minutos antes
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Recordatorio de asesoría TISNET',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean);

    return lines.join('\r\n');
  }

  /**
   * Generates direct click-to-add calendar links for Google Calendar, Outlook, etc.
   */
  static generateLinks(event: CalendarEventData): CalendarLinks {
    const formatGoogleDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const startGoogle = formatGoogleDate(event.startTime);
    const endGoogle = formatGoogleDate(event.endTime);

    // Google Calendar Link
    const googleParams = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${startGoogle}/${endGoogle}`,
      details: event.description,
      location: event.location || event.url || '',
    });
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?${googleParams.toString()}`;

    // Outlook Live Link
    const outlookParams = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: event.title,
      startdt: event.startTime.toISOString(),
      enddt: event.endTime.toISOString(),
      body: event.description,
      location: event.location || event.url || '',
    });
    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams.toString()}`;

    // Office 365 Link
    const office365Url = `https://outlook.office.com/calendar/0/deeplink/compose?${outlookParams.toString()}`;

    return {
      googleCalendarUrl,
      outlookUrl,
      office365Url,
      icsContent: this.generateIcs(event),
    };
  }
}
