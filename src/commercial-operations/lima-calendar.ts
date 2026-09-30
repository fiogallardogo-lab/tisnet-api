import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getPeruvianHolidaysForYear } from '../common/business-days/peruvian-holidays';

export function reminderPolicy(config: ConfigService) {
  const cutoff = config.get<string>('PAYMENT_REMINDER_CUTOFF')?.trim();
  const calendarVersion = config
    .get<string>('PAYMENT_REMINDER_POLICY_VERSION')
    ?.trim();
  const trigger = config.get<string>('PAYMENT_REMINDER_TRIGGER') || 'APPROVED';
  if (
    !cutoff ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff) ||
    !calendarVersion ||
    calendarVersion.length > 100 ||
    !['SUBMITTED', 'APPROVED'].includes(trigger)
  ) {
    throw new ServiceUnavailableException(
      'Configura el evento, hora límite y versión aprobada de la política de recordatorios.',
    );
  }
  const extraHolidays = (
    config.get<string>('PAYMENT_REMINDER_EXTRA_HOLIDAYS') || ''
  )
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (
    extraHolidays.some(
      (x) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(x) ||
        !Number.isFinite(Date.parse(x)) ||
        new Date(x).toISOString().slice(0, 10) !== x,
    )
  )
    throw new ServiceUnavailableException('Calendario adicional inválido.');
  return { cutoff, calendarVersion, trigger, extraHolidays };
}

/** Exclude the event's Lima civil date; third following working date, at approved cutoff. */
export function threeLimaBusinessDays(
  occurredAt: Date,
  cutoff: string,
  extraHolidays: string[] = [],
) {
  if (
    !Number.isFinite(occurredAt.getTime()) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff)
  )
    throw new Error('Invalid reminder date/cutoff');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(occurredAt);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  const day = new Date(
    part('year') + '-' + part('month') + '-' + part('day') + 'T00:00:00Z',
  );
  let count = 0;
  while (count < 3) {
    day.setUTCDate(day.getUTCDate() + 1);
    const key = day.toISOString().slice(0, 10);
    if (
      ![0, 6].includes(day.getUTCDay()) &&
      !extraHolidays.includes(key) &&
      !getPeruvianHolidaysForYear(day.getUTCFullYear()).some(
        (h) => h.dateKey === key,
      )
    )
      count++;
  }
  // Peru's America/Lima civil offset is UTC-05 for the operational dates supported.
  return new Date(day.toISOString().slice(0, 10) + 'T' + cutoff + ':00-05:00');
}
