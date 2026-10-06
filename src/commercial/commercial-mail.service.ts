import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  DOCUMENT_RENDERER,
  type DocumentRenderer,
} from '../documents/document-renderer.interface';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
  type SendNotificationInput,
} from '../notifications/notification-provider.interface';
import { escapeHtml } from '../notifications/templates/escape-html';
import { renderClientActivationEmail } from '../notifications/templates/client-activation-notification';
import { CalendarUtils } from '../common/utils/calendar.utils';
@Injectable()
export class CommercialMailService {
  private readonly logger = new Logger(CommercialMailService.name);
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    @Inject(DOCUMENT_RENDERER) private readonly renderer: DocumentRenderer,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly provider: NotificationProvider,
  ) {}
  links() {
    const url = new URL(
      this.config.get<string>('PUBLIC_FRONTEND_URL') ||
        this.config.get<string>('FRONTEND_URL')?.split(',')[0] ||
        'http://localhost:5173',
    );
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error('Invalid frontend URL');
    return {
      quote: new URL('/quote', url).href,
      register: new URL('/register', url).href,
      agenda: new URL('/quote', url).href,
      activate: new URL('/activate', url).href,
      login: new URL('/login', url).href,
    };
  }
  cta() {
    const l = this.links();
    return {
      text:
        'Cotiza: ' +
        l.quote +
        '\nRegístrate: ' +
        l.register +
        '\nAgenda asesoría: ' +
        l.agenda,
      html:
        '<p><a href="' +
        escapeHtml(l.quote) +
        '">Cotizar</a> · <a href="' +
        escapeHtml(l.register) +
        '">Registrarse</a> · <a href="' +
        escapeHtml(l.agenda) +
        '">Agendar asesoría</a></p>',
    };
  }
  isRealDeliveryConfigured() {
    return this.provider.deliveryMode !== 'simulated';
  }
  async send(
    input: SendNotificationInput,
    entityType: string,
    entityId: number | string,
  ) {
    let result;
    try {
      result = await this.provider.send(input);
    } catch {
      await this.record('COMMERCIAL_MAIL_FAILED', entityType, entityId);
      return { delivery: 'FAILED' as const };
    }
    await this.record('COMMERCIAL_MAIL_SENT', entityType, entityId);
    return { delivery: 'SENT' as const, messageId: result.messageId };
  }
  private async record(
    action: string,
    entityType: string,
    entityId: number | string,
  ) {
    try {
      await this.db.auditEvent.create({
        data: { action, entityType, entityId: String(entityId), metadata: {} },
      });
    } catch {
      this.logger.error(
        'No se pudo registrar el resultado de notificación: ' +
          entityType +
          ' ' +
          entityId,
      );
    }
  }
  async quote(id: number, versionId?: number) {
    const q = await this.db.quote.findUnique({
      where: { id },
      include: {
        options: true,
        items: true,
        versions: {
          ...(versionId !== undefined ? { where: { id: versionId } } : {}),
          orderBy: { version: 'desc' },
          take: 1,
          include: { schedules: { orderBy: { sequence: 'asc' } } },
        },
      },
    });
    if (!q) throw new NotFoundException('Cotización no encontrada.');
    const v = q.versions[0];
    if (versionId !== undefined && !v)
      throw new NotFoundException('Versión no encontrada.');
    try {
      const doc = await this.renderer.renderQuote({
        publicCode: q.publicCode,
        contactName: q.contactName,
        contactEmail: q.contactEmail,
        solutionType: q.solutionType,
        createdAt: v?.createdAt || q.createdAt,
        options: q.options.map((o) => ({
          code: o.optionCode,
          label: o.optionName,
        })),
        items: v
          ? v.schedules.map((s) => ({
              code: 'CUOTA_' + s.sequence,
              label: s.milestone,
              amountMinor: Number(s.amountMinor),
            }))
          : q.items.map((i) => ({
              code: i.itemCode,
              label: i.label,
              amountMinor: Number(i.amountMinor),
            })),
        pricing: {
          currency: v?.currency || q.currency || 'PEN',
          pricingVersion: v ? 'OFFICIAL-v' + v.version : q.pricingVersion,
          totalMinor: v
            ? Number(v.amountMinor)
            : q.amountMinor === null
              ? null
              : Number(q.amountMinor),
        },
      });
      const cta = this.cta();
      return await this.send(
        {
          recipient: q.contactEmail,
          subject:
            'Cotización TISNET ' +
            q.publicCode +
            (v ? ' · versión ' + v.version : ''),
          text: 'Adjuntamos tu cotización ' + q.publicCode + '.\n' + cta.text,
          html:
            '<p>Adjuntamos tu cotización <strong>' +
            escapeHtml(q.publicCode) +
            '</strong>.</p>' +
            cta.html,
          attachments: [
            {
              filename:
                q.publicCode + (v ? '-v' + v.version : '-preliminar') + '.pdf',
              mimeType: doc.mimeType,
              content: doc.content,
            },
          ],
        },
        'QUOTE',
        id,
      );
    } catch {
      await this.record('COMMERCIAL_MAIL_FAILED', 'QUOTE', id);
      return { delivery: 'FAILED' as const };
    }
  }
  async quoteAfterCommit(id: number, versionId: number) {
    try {
      return await this.quote(id, versionId);
    } catch {
      await this.record('COMMERCIAL_MAIL_FAILED', 'QUOTE', id);
      return { delivery: 'FAILED' as const };
    }
  }
  async quoteByCode(code: string) {
    try {
      const q = await this.db.quote.findUnique({
        where: { publicCode: code },
        select: { id: true },
      });
      if (q) return await this.quote(q.id);
    } catch {
      this.logger.error('Falló el envío de cotización; solicitud preservada.');
    }
  }
  async meeting(id: number) {
    try {
      const m = await this.db.meeting.findUnique({
        where: { id },
        include: {
          prospect: true,
          quote: true,
          advisorProfile: { include: { user: true } },
        },
      });
      if (!m) return;

      const cta = this.cta();
      const statusLabel =
        m.status === 'SCHEDULED'
          ? 'Confirmada'
          : m.status === 'CANCELLED'
            ? 'Cancelada'
            : m.status === 'COMPLETED'
              ? 'Completada'
              : 'Registrada';

      const advisorName = m.advisorProfile?.user.name || 'Asesor TISNET';
      const advisorEmail = m.advisorProfile?.user.email || 'contacto@tisnet.pe';
      const clientName = m.prospect?.name || 'Cliente';
      const quoteCode = m.quote?.publicCode ? ` (Cotización ${m.quote.publicCode})` : '';

      const dateStr = m.scheduledAt
        ? new Date(m.scheduledAt).toLocaleString('es-PE', {
            dateStyle: 'full',
            timeStyle: 'short',
            timeZone: m.timezone || 'America/Lima',
          })
        : 'Fecha por definir';

      const meetingUrl =
        m.externalEventUri || `https://app.tisnet.pe/meetings/${m.id}`;

      let calendarLinks = null;
      let attachments: SendNotificationInput['attachments'] = undefined;

      if (m.scheduledAt) {
        const startTime = m.scheduledAt;
        const endTime = m.endsAt || new Date(startTime.getTime() + 3600000);

        calendarLinks = CalendarUtils.generateLinks({
          title: `Sesión de Asesoría TISNET${quoteCode}`,
          description: `Reunión de alineación de cotización y alcance con ${advisorName}.\nEnlace de videollamada: ${meetingUrl}`,
          location: meetingUrl,
          startTime,
          endTime,
          organizerName: advisorName,
          organizerEmail: advisorEmail,
          attendeeName: clientName,
          attendeeEmail: m.prospect.email,
          url: meetingUrl,
        });

        attachments = [
          {
            filename: `reunion-tisnet-${m.id}.ics`,
            mimeType: 'text/calendar; charset=utf-8; method=REQUEST',
            content: Buffer.from(calendarLinks.icsContent, 'utf-8'),
          },
        ];
      }

      // ─── Correo para el Cliente ───
      const clientText = [
        `Hola ${clientName},`,
        `Tu sesión de asesoría comercial y técnica para afinar tu cotización ha sido ${statusLabel.toLowerCase()}.`,
        `Asesor asignado: ${advisorName}`,
        `Fecha y hora: ${dateStr}`,
        `Enlace de la videollamada: ${meetingUrl}`,
        `Adjuntamos la invitación oficial de calendario (.ics) a este correo para que quede agendada en tu dispositivo.`,
        m.prospect.phone
          ? `Recordatorio adicional: Te enviaremos un aviso con el enlace directo por WhatsApp al ${m.prospect.phone} 15 minutos antes de la reunión.`
          : '',
        cta.text,
      ]
        .filter(Boolean)
        .join('\n\n');

      const clientHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #0f172a; margin: 0; font-size: 22px;">Sesión de Asesoría TISNET</h2>
            <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Alineación de propuesta ${escapeHtml(quoteCode)}</p>
          </div>

          <p>Hola <strong>${escapeHtml(clientName)}</strong>,</p>
          <p>Tu solicitud de reunión para revisar los detalles técnicos y comerciales de tu cotización está <strong>${escapeHtml(statusLabel.toLowerCase())}</strong>.</p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>👤 Asesor asignado:</strong> ${escapeHtml(advisorName)}</p>
            <p style="margin: 0 0 8px 0;"><strong>📅 Fecha y hora:</strong> ${escapeHtml(dateStr)}</p>
            <p style="margin: 0;"><strong>📍 Medio:</strong> Videollamada virtual (${escapeHtml(meetingUrl)})</p>
          </div>

          <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 14px 18px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-weight: 600; color: #1e40af; font-size: 14px;">¿Cómo accederás a tu reunión?</p>
            <p style="margin: 6px 0 0 0; color: #1e3a8a; font-size: 13px;">
              El enlace se encuentra adjunto en la invitación de calendario de este correo. Además, recibirás un recordatorio automático por este medio antes de comenzar.
              ${
                m.prospect.phone
                  ? `<br><br>💬 <strong>WhatsApp:</strong> También te enviaremos un aviso con el enlace directo a tu número <strong>${escapeHtml(m.prospect.phone)}</strong> 15 minutos antes.`
                  : ''
              }
            </p>
          </div>

          ${
            calendarLinks
              ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${escapeHtml(calendarLinks.googleCalendarUrl)}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 500; font-size: 14px; margin: 4px 6px;">📅 Agregar a Google Calendar</a>
            <a href="${escapeHtml(calendarLinks.outlookUrl)}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 500; font-size: 14px; margin: 4px 6px;">📅 Agregar a Outlook</a>
          </div>
          `
              : ''
          }

          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <div style="font-size: 12px; color: #64748b; text-align: center;">
            ${cta.html}
            <p style="margin-top: 12px;">Equipo TISNET · Soluciones Digitales</p>
          </div>
        </div>
      `;

      // Enviar al cliente
      if (m.prospect.email) {
        await this.send(
          {
            recipient: m.prospect.email,
            subject: `TISNET · Sesión de asesoría ${statusLabel.toLowerCase()} con ${advisorName}`,
            text: clientText,
            html: clientHtml,
            attachments,
          },
          'MEETING',
          id,
        );
      }

      // Enviar notificación al Asesor
      if (m.advisorProfile?.user.email && m.advisorProfile.user.email !== m.prospect.email) {
        const advisorText = `Nueva sesión de asesoría asignada con el cliente ${clientName} (${m.prospect.email}). Fecha: ${dateStr}.\nEnlace: ${meetingUrl}`;
        await this.send(
          {
            recipient: m.advisorProfile.user.email,
            subject: `TISNET · Nueva sesión de asesoría asignada - ${clientName}`,
            text: advisorText,
            html: `<p>${escapeHtml(advisorText).replace(/\n/g, '<br>')}</p>`,
            attachments,
          },
          'MEETING',
          id,
        );
      }
    } catch {
      await this.record('COMMERCIAL_MAIL_FAILED', 'MEETING', id);
    }
  }

  async sendClientActivationEmail(input: {
    recipientName: string;
    recipientEmail: string;
    password: string;
    company?: string | null;
    quoteCode?: string | null;
    solutionType?: string | null;
    userId?: number;
  }) {
    try {
      const loginUrl = this.links().login;
      const { subject, html, text } = renderClientActivationEmail({
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
        password: input.password,
        loginUrl,
        company: input.company,
        quoteCode: input.quoteCode,
        solutionType: input.solutionType,
      });

      return await this.send(
        {
          recipient: input.recipientEmail,
          subject,
          html,
          text,
        },
        'USER_ACTIVATION',
        input.userId ?? input.recipientEmail,
      );
    } catch (error) {
      this.logger.error('Error al enviar correo de activación de cliente', error);
      if (input.userId) {
        await this.record('COMMERCIAL_MAIL_FAILED', 'USER_ACTIVATION', input.userId);
      }
      return { delivery: 'FAILED' as const };
    }
  }
}
