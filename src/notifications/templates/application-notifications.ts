import { isEmail } from 'class-validator';
import type {
  ApplicationAcceptedNotification,
  ApplicationNotificationMessage,
  ApplicationReceivedNotification,
  InterviewAssignedNotification,
  RejectedApplicationNotification,
} from '../application-notification.types';
import { escapeHtml } from './escape-html';

function validateCommon(
  input:
    | InterviewAssignedNotification
    | RejectedApplicationNotification
    | ApplicationReceivedNotification
    | ApplicationAcceptedNotification,
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

export function renderApplicationReceived(
  input: ApplicationReceivedNotification,
): ApplicationNotificationMessage {
  validateCommon(input);
  const notes = input.confirmationNotes?.trim();
  return {
    recipient: input.recipient,
    subject: `Postulación recibida — ${input.applicationCode}`,
    text: [
      `Hola, ${input.candidateName}.`,
      `Hemos recibido tu postulación ${input.applicationCode} para la posición de ${input.requestedRole}.`,
      notes ??
        'Nuestro equipo técnico evaluará tu perfil y tu experiencia. Si tu perfil coincide con los requerimientos, nos comunicaremos contigo para coordinar una entrevista técnica.',
      'Agradecemos tu interés en unirte al equipo de TISNET.\nEquipo TISNET',
    ].join('\n\n'),
    html: [
      `<p>Hola, ${escapeHtml(input.candidateName)}.</p>`,
      `<p>Hemos recibido tu postulación <strong>${escapeHtml(input.applicationCode)}</strong> para la posición de <strong>${escapeHtml(input.requestedRole)}</strong>.</p>`,
      notes
        ? `<p>${escapeHtml(notes).replace(/\r?\n/g, '<br>')}</p>`
        : '<p>Nuestro equipo técnico evaluará tu perfil y tu experiencia. Si tu perfil coincide con los requerimientos, nos comunicaremos contigo para coordinar una entrevista técnica.</p>',
      '<p>Agradecemos tu interés en unirte al equipo de TISNET.<br>Equipo TISNET</p>',
    ].join('\n'),
    metadata: {
      type: 'APPLICATION_RECEIVED',
      applicationCode: input.applicationCode,
    },
  };
}

export function renderApplicationAccepted(
  input: ApplicationAcceptedNotification,
): ApplicationNotificationMessage {
  validateCommon(input);
  const url = schedulingUrl(input.onboardingUrl);
  const steps = input.nextSteps?.trim();
  const nextStepsText = steps
    ? steps
    : 'Nuestro equipo de operaciones se comunicará contigo en breve para formalizar tu incorporación y coordinar el acceso a las herramientas del proyecto.';

  return {
    recipient: input.recipient,
    subject: `¡Bienvenido al equipo! — Postulación ${input.applicationCode}`,
    text: [
      `¡Felicitaciones, ${input.candidateName}!`,
      `Nos complace comunicarte que tu postulación ${input.applicationCode} para el rol de ${input.requestedRole} ha sido aprobada.`,
      nextStepsText,
      url ? `Accede al portal de incorporación aquí: ${url}` : '',
      '¡Te damos una cálida bienvenida a TISNET!\nEquipo TISNET',
    ]
      .filter(Boolean)
      .join('\n\n'),
    html: [
      `<p>¡Felicitaciones, <strong>${escapeHtml(input.candidateName)}</strong>!</p>`,
      `<p>Nos complace comunicarte que tu postulación <strong>${escapeHtml(input.applicationCode)}</strong> para el rol de <strong>${escapeHtml(input.requestedRole)}</strong> ha sido aprobada.</p>`,
      `<p>${escapeHtml(nextStepsText).replace(/\r?\n/g, '<br>')}</p>`,
      url
        ? `<p>Accede al portal de incorporación aquí: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`
        : '',
      '<p>¡Te damos una cálida bienvenida a TISNET!<br>Equipo TISNET</p>',
    ]
      .filter(Boolean)
      .join('\n'),
    metadata: {
      type: 'APPLICATION_ACCEPTED',
      applicationCode: input.applicationCode,
    },
  };
}
