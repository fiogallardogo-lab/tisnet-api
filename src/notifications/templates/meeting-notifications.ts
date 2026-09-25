import { isEmail } from 'class-validator';
import type {
  MeetingCancelledNotification,
  MeetingConfirmedNotification,
  MeetingNotification,
  MeetingNotificationMessage,
  MeetingRescheduledNotification,
} from '../meeting-notification.types';
import { escapeHtml } from './escape-html';

// ─── Validation helpers ─────────────────────────────────────────────────────

function requireEmail(value: string, label: string): void {
  if (!isEmail(value) || /[\r\n]/.test(value)) {
    throw new Error('Invalid meeting notification ' + label + ': must be a valid email without newlines');
  }
}

function requireText(value: string | undefined, label: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Missing required field: ' + label);
  }
}

function requireMeetingUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid meetingUrl: must be a valid URL');
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
    throw new Error('meetingUrl must use HTTP/HTTPS without credentials');
  }
  return url.href;
}

function requireIso(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid ISO date for ' + label + ': ' + value);
  }
  return date;
}

function validateBase(input: MeetingNotification): void {
  requireEmail(input.recipient, 'recipient');
  requireText(input.attendeeName, 'attendeeName');
  requireText(input.advisorName, 'advisorName');
  requireIso(input.startIso, 'startIso');
  requireIso(input.endIso, 'endIso');
  requireMeetingUrl(input.meetingUrl);
  if (input.quoteCode !== undefined && /[\r\n]/.test(input.quoteCode)) {
    throw new Error('Invalid quoteCode: must not contain newlines');
  }
}

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatDatetime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Lima',
    timeZoneName: 'short',
  });
}

// ─── Template renderers ───────────────────────────────────────────────────────

export function renderMeetingConfirmed(
  input: MeetingConfirmedNotification,
): MeetingNotificationMessage {
  validateBase(input);
  const start = formatDatetime(input.startIso);
  const url = requireMeetingUrl(input.meetingUrl);
  const quoteInfo = input.quoteCode
    ? ' relacionada con la cotizacion ' + input.quoteCode
    : '';

  const text = [
    'Hola, ' + input.attendeeName + '.',
    'Tu reunion con ' + input.advisorName + quoteInfo + ' ha sido confirmada.',
    'Fecha y hora: ' + start,
    'Enlace de reunion: ' + url,
    'Si tienes alguna pregunta antes de la reunion, puedes responder a este correo.',
    'Equipo TISNET',
  ].join('\n\n');

  const html = [
    '<p>Hola, ' + escapeHtml(input.attendeeName) + '.</p>',
    '<p>Tu reunion con <strong>' + escapeHtml(input.advisorName) + '</strong>' +
      (input.quoteCode ? ' relacionada con la cotizacion <strong>' + escapeHtml(input.quoteCode) + '</strong>' : '') +
      ' ha sido confirmada.</p>',
    '<p><strong>Fecha y hora:</strong> ' + escapeHtml(start) + '</p>',
    '<p><strong>Enlace de reunion:</strong> <a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a></p>',
    '<p>Si tienes alguna pregunta antes de la reunion, puedes responder a este correo.</p>',
    '<p>Equipo TISNET</p>',
  ].join('\n');

  return {
    recipient: input.recipient,
    subject: 'Reunion confirmada con ' + input.advisorName + ' - TISNET',
    text,
    html,
    metadata: { type: 'MEETING_CONFIRMED', meetingUrl: url },
  };
}

export function renderMeetingCancelled(
  input: MeetingCancelledNotification,
): MeetingNotificationMessage {
  validateBase(input);
  const start = formatDatetime(input.startIso);
  const url = requireMeetingUrl(input.meetingUrl);
  const reason = input.cancellationReason?.trim();

  const text = [
    'Hola, ' + input.attendeeName + '.',
    'Tu reunion con ' + input.advisorName + ' programada para ' + start + ' ha sido cancelada.',
    reason ? 'Motivo: ' + reason : '',
    'Si deseas agendar una nueva reunion, por favor contactanos.',
    'Equipo TISNET',
  ].filter(Boolean).join('\n\n');

  const html = [
    '<p>Hola, ' + escapeHtml(input.attendeeName) + '.</p>',
    '<p>Tu reunion con <strong>' + escapeHtml(input.advisorName) + '</strong> programada para <strong>' + escapeHtml(start) + '</strong> ha sido cancelada.</p>',
    reason ? '<p><strong>Motivo:</strong> ' + escapeHtml(reason).replace(/\r?\n/g, '<br>') + '</p>' : '',
    '<p>Si deseas agendar una nueva reunion, por favor contactanos.</p>',
    '<p>Equipo TISNET</p>',
  ].filter(Boolean).join('\n');

  return {
    recipient: input.recipient,
    subject: 'Reunion cancelada - TISNET',
    text,
    html,
    metadata: { type: 'MEETING_CANCELLED', meetingUrl: url },
  };
}

export function renderMeetingRescheduled(
  input: MeetingRescheduledNotification,
): MeetingNotificationMessage {
  validateBase(input);
  requireIso(input.previousStartIso, 'previousStartIso');
  const newStart = formatDatetime(input.startIso);
  const prevStart = formatDatetime(input.previousStartIso);
  const url = requireMeetingUrl(input.meetingUrl);

  const text = [
    'Hola, ' + input.attendeeName + '.',
    'Tu reunion con ' + input.advisorName + ' ha sido reprogramada.',
    'Fecha anterior: ' + prevStart,
    'Nueva fecha y hora: ' + newStart,
    'Enlace de reunion: ' + url,
    'Equipo TISNET',
  ].join('\n\n');

  const html = [
    '<p>Hola, ' + escapeHtml(input.attendeeName) + '.</p>',
    '<p>Tu reunion con <strong>' + escapeHtml(input.advisorName) + '</strong> ha sido reprogramada.</p>',
    '<p><strong>Fecha anterior:</strong> ' + escapeHtml(prevStart) + '</p>',
    '<p><strong>Nueva fecha y hora:</strong> ' + escapeHtml(newStart) + '</p>',
    '<p><strong>Enlace de reunion:</strong> <a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a></p>',
    '<p>Equipo TISNET</p>',
  ].join('\n');

  return {
    recipient: input.recipient,
    subject: 'Reunion reprogramada con ' + input.advisorName + ' - TISNET',
    text,
    html,
    metadata: { type: 'MEETING_RESCHEDULED', meetingUrl: url },
  };
}