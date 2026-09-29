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
          advisorProfile: { include: { user: true } },
        },
      });
      if (!m) return;
      const cta = this.cta();
      const status =
        m.status === 'SCHEDULED'
          ? 'confirmada'
          : m.status === 'CANCELLED'
            ? 'cancelada'
            : m.status === 'COMPLETED'
              ? 'completada'
              : 'pendiente de confirmación';
      const text =
        'Reunión ' +
        status +
        '. Fecha: ' +
        (m.scheduledAt?.toLocaleString('es-PE', { timeZone: m.timezone }) ||
          'pendiente') +
        '. Asesor: ' +
        (m.advisorProfile?.user.name || 'por asignar');
      for (const recipient of new Set(
        [m.prospect.email, m.advisorProfile?.user.email].filter(
          (x): x is string => !!x,
        ),
      ))
        await this.send(
          {
            recipient,
            subject: 'TISNET · reunión ' + status,
            text: text + '\n' + cta.text,
            html: '<p>' + escapeHtml(text) + '</p>' + cta.html,
          },
          'MEETING',
          id,
        );
    } catch {
      await this.record('COMMERCIAL_MAIL_FAILED', 'MEETING', id);
    }
  }
}
