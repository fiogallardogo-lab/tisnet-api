import { isEmail } from 'class-validator';
import type {
  ApplicationNotificationMessage,
  InterviewAssignedNotification,
  RejectedApplicationNotification,
} from '../application-notification.types';
import { escapeHtml } from './escape-html';

function validateCommon(
  input: InterviewAssignedNotification | RejectedApplicationNotification,
) {
  if (!isEmail(input.recipient) || /[\r\n]/.test(input.recipient)) {
    throw new Error('Invalid notification recipient');
  }
  // Preserve the domain's identifier format while preventing email header injection.
  if (
    typeof input.applicationCode !== 'string' ||
    !input.applicationCode.trim() ||
    /[\r\n]/.test(input.applicationCode)
  ) {
    throw new Error('Invalid applicationCode');
  }
  for (const value of [input.candidateName, input.requestedRole]) {
    requireText(value);
  }
}

function requireText(value: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Missing notification text');
  }
}

function schedulingUrl(value?: string | null): string | undefined {
  if (value == null || value.trim() === '') return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid scheduling URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Scheduling URL must use HTTPS without credentials');
  }
  return url.href;
}

export function renderInterviewAssigned(
  input: InterviewAssignedNotification,
): ApplicationNotificationMessage {
  validateCommon(input);
  requireText(input.interviewerName);
  const url = schedulingUrl(input.calendlyUrl);
  const coordination = url
    ? `Coordina tu entrevista aquí: ${url}`
    : 'Nuestro equipo se pondrá en contacto contigo para coordinar la entrevista.';
  return {
    recipient: input.recipient,
    subject: `Entrevista asignada — Postulación ${input.applicationCode}`,
    text: [
      `Hola, ${input.candidateName}.`,
      `Tu postulación ${input.applicationCode} para el rol ${input.requestedRole} avanzó a la etapa de entrevista.`,
      `Tu entrevistador será ${input.interviewerName}.`,
      coordination,
      'Gracias por tu interés en formar parte de TISNET.\nEquipo TISNET',
    ].join('\n\n'),
    html: [
      `<p>Hola, ${escapeHtml(input.candidateName)}.</p>`,
      `<p>Tu postulación <strong>${escapeHtml(input.applicationCode)}</strong> para el rol ${escapeHtml(input.requestedRole)} avanzó a la etapa de entrevista.</p>`,
      `<p>Tu entrevistador será ${escapeHtml(input.interviewerName)}.</p>`,
      url
        ? `<p>Coordina tu entrevista aquí: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`
        : `<p>${escapeHtml(coordination)}</p>`,
      '<p>Gracias por tu interés en formar parte de TISNET.<br>Equipo TISNET</p>',
    ].join('\n'),
    metadata: {
      type: 'INTERVIEW_ASSIGNED',
      applicationCode: input.applicationCode,
    },
  };
}

export function renderRejectedApplication(
  input: RejectedApplicationNotification,
): ApplicationNotificationMessage {
  validateCommon(input);
  requireText(input.rejectionReason);
  return {
    recipient: input.recipient,
    subject: `Resultado de postulación — ${input.applicationCode}`,
    text: [
      `Hola, ${input.candidateName}.`,
      `Gracias por postular a TISNET. En esta oportunidad, tu postulación ${input.applicationCode} para el rol ${input.requestedRole} no continuará en el proceso.`,
      `Motivo: ${input.rejectionReason}`,
      'Agradecemos tu tiempo y tu interés. Te deseamos éxito en tus próximos proyectos.\nEquipo TISNET',
    ].join('\n\n'),
    html: [
      `<p>Hola, ${escapeHtml(input.candidateName)}.</p>`,
      `<p>Gracias por postular a TISNET. En esta oportunidad, tu postulación <strong>${escapeHtml(input.applicationCode)}</strong> para el rol ${escapeHtml(input.requestedRole)} no continuará en el proceso.</p>`,
      `<p>Motivo: ${escapeHtml(input.rejectionReason).replace(/\r?\n/g, '<br>')}</p>`,
      '<p>Agradecemos tu tiempo y tu interés. Te deseamos éxito en tus próximos proyectos.<br>Equipo TISNET</p>',
    ].join('\n'),
    metadata: {
      type: 'APPLICATION_REJECTED',
      applicationCode: input.applicationCode,
    },
  };
}
