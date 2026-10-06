import { CalendarUtils, CalendarEventData } from './calendar.utils';

describe('CalendarUtils', () => {
  const mockEvent: CalendarEventData = {
    title: 'Alineación de Propuesta - Cotización COT-1234',
    description: 'Reunión para revisar la propuesta de cotización y alcance del proyecto.',
    location: 'https://meet.google.com/abc-defg-hij',
    startTime: new Date('2026-10-15T15:00:00.000Z'),
    endTime: new Date('2026-10-15T16:00:00.000Z'),
    organizerName: 'Oliver Asesor',
    organizerEmail: 'asesor@tisnet.pe',
    attendeeName: 'Carlos Cliente',
    attendeeEmail: 'carlos@ejemplo.com',
    url: 'https://meet.google.com/abc-defg-hij',
  };

  it('generates valid RFC-5545 .ics calendar content', () => {
    const ics = CalendarUtils.generateIcs(mockEvent);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Alineación de Propuesta - Cotización COT-1234');
    expect(ics).toContain('ORGANIZER;CN=Oliver Asesor:mailto:asesor@tisnet.pe');
    expect(ics).toContain('ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=Carlos Cliente:mailto:carlos@ejemplo.com');
    expect(ics).toContain('LOCATION:https://meet.google.com/abc-defg-hij');
    expect(ics).toContain('TRIGGER:-PT15M'); // 15-min reminder alarm
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('generates direct Google Calendar and Outlook URLs', () => {
    const links = CalendarUtils.generateLinks(mockEvent);

    expect(links.googleCalendarUrl).toContain('https://calendar.google.com/calendar/render');
    expect(links.googleCalendarUrl).toContain('action=TEMPLATE');
    expect(links.googleCalendarUrl).toContain('Alineaci%C3%B3n+de+Propuesta');
    expect(links.googleCalendarUrl).toContain('20261015T150000Z');

    expect(links.outlookUrl).toContain('https://outlook.live.com/calendar/0/deeplink/compose');
    expect(links.office365Url).toContain('https://outlook.office.com/calendar/0/deeplink/compose');
    expect(links.icsContent).toBeDefined();
  });
});
