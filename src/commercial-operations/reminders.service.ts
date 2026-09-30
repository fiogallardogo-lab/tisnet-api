import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '../notifications/notification-provider.interface';
import { escapeHtml } from '../notifications/templates/escape-html';
import { auditRecord } from '../audit/audit.service';
import { reminderPolicy, threeLimaBusinessDays } from './lima-calendar';
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private running = false;
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    @Inject(NOTIFICATION_PROVIDER) private readonly mail: NotificationProvider,
  ) {}
  async schedule(
    tx: Prisma.TransactionClient,
    deliverableId: number,
    trigger: 'SUBMITTED' | 'APPROVED',
    actorId: number,
  ) {
    const configuredTrigger =
      this.config.get<string>('PAYMENT_REMINDER_TRIGGER') || 'APPROVED';
    if (!['SUBMITTED', 'APPROVED'].includes(configuredTrigger))
      throw new ServiceUnavailableException(
        'Configura un evento de recordatorio aprobado.',
      );
    if (trigger !== configuredTrigger) return;
    const d = await tx.projectDeliverable.findUnique({
      where: { id: deliverableId },
      include: {
        milestone: {
          include: {
            paymentSchedule: {
              include: {
                quoteVersion: { include: { quote: true } },
                payments: { where: { status: 'CONFIRMED' } },
              },
            },
          },
        },
      },
    });
    const s = d?.milestone?.paymentSchedule;
    if (
      !d ||
      !s ||
      !s.quoteVersion.acceptedAt ||
      s.quoteVersion.quote.activeVersion !== s.quoteVersion.version
    )
      return;
    if (
      s.payments.reduce((sum, p) => sum + Number(p.amountMinor), 0) >=
      Number(s.amountMinor)
    )
      return;
    await tx.$queryRawUnsafe(
      'SELECT id FROM PaymentSchedule WHERE id = ? FOR UPDATE',
      s.id,
    );
    if (await tx.paymentReminder.findUnique({ where: { scheduleId: s.id } }))
      return;
    const policy = reminderPolicy(this.config);
    const occurredAt =
      (trigger === 'APPROVED' ? d.reviewedAt : d.submittedAt) || new Date();
    const dueAt = threeLimaBusinessDays(
      occurredAt,
      policy.cutoff,
      policy.extraHolidays,
    );
    const recipients = await tx.user.findMany({
      where: {
        isActive: true,
        OR: [
          { id: s.quoteVersion.clientUserId, role: { name: 'CLIENT' } },
          { role: { name: { in: ['ADMIN', 'SUPER_ADMIN'] } } },
        ],
      },
      select: { id: true, role: { select: { name: true } } },
    });
    if (
      !recipients.some((x) => x.id === s.quoteVersion.clientUserId) ||
      !recipients.some((x) => ['ADMIN', 'SUPER_ADMIN'].includes(x.role.name))
    )
      throw new ServiceUnavailableException(
        'Se requieren cliente y administrador activos para el recordatorio.',
      );
    const reminder = await tx.paymentReminder.create({
      data: {
        scheduleId: s.id,
        deliverableId,
        trigger,
        occurredAt,
        dueAt,
        cutoff: policy.cutoff,
        calendarVersion: policy.calendarVersion,
        deliveries: {
          create: recipients.map((x) => ({
            userId: x.id,
            audience: x.id === s.quoteVersion.clientUserId ? 'CLIENT' : 'ADMIN',
            nextAttemptAt: dueAt,
          })),
        },
      },
    });
    await auditRecord(tx, {
      actorId,
      action: 'PAYMENT_REMINDER_SCHEDULED',
      entityType: 'PAYMENT_REMINDER',
      entityId: String(reminder.id),
      metadata: {
        scheduleId: s.id,
        deadline: dueAt.toISOString(),
        count: recipients.length,
      },
    });
    return reminder;
  }
  @Interval(60000)
  async tick() {
    if (this.config.get('PAYMENT_REMINDERS_ENABLED') !== 'true' || this.running)
      return;
    this.running = true;
    try {
      await this.dispatch();
    } catch {
      this.logger.error('PAYMENT_REMINDER_WORKER_FAILED');
    } finally {
      this.running = false;
    }
  }
  async dispatch(now = new Date()) {
    const eligible: Prisma.PaymentReminderDeliveryWhereInput = {
      nextAttemptAt: { lte: now },
      OR: [
        { status: 'PENDING' },
        { status: 'SENDING', leaseUntil: { lt: now } },
      ],
    };
    const candidates = await this.db.paymentReminderDelivery.findMany({
      where: eligible,
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 50,
    });
    let processed = 0;
    for (const candidate of candidates) {
      const claimToken = randomUUID();
      const claim = await this.db.paymentReminderDelivery.updateMany({
        where: { id: candidate.id, ...eligible },
        data: {
          status: 'SENDING',
          claimToken,
          leaseUntil: new Date(now.getTime() + 180000),
          attempts: { increment: 1 },
        },
      });
      if (claim.count !== 1) continue;
      await this.deliver(candidate.id, claimToken, now);
      processed++;
    }
    return { processed };
  }
  private async deliver(id: number, claimToken: string, now: Date) {
    try {
      const job = await this.db.paymentReminderDelivery.findUniqueOrThrow({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isActive: true,
              role: { select: { name: true } },
            },
          },
          reminder: {
            include: {
              deliverable: { select: { status: true } },
              schedule: {
                include: {
                  payments: { where: { status: 'CONFIRMED' } },
                  quoteVersion: {
                    include: {
                      quote: {
                        include: { prospect: { select: { userId: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      const s = job.reminder.schedule,
        v = s.quoteVersion;
      const paid = s.payments.reduce(
        (sum, p) => sum + Number(p.amountMinor),
        0,
      );
      const authorized =
        job.user.isActive &&
        (job.audience === 'ADMIN'
          ? ['ADMIN', 'SUPER_ADMIN'].includes(job.user.role.name)
          : job.user.role.name === 'CLIENT' &&
            job.user.id === v.clientUserId &&
            v.quote.prospect?.userId === job.user.id);
      if (
        !authorized ||
        !v.acceptedAt ||
        v.quote.activeVersion !== v.version ||
        paid >= Number(s.amountMinor)
      ) {
        await this.finish(id, claimToken, 'CANCELLED', {
          lastErrorCode: 'NO_LONGER_PAYABLE',
        });
        return;
      }
      if (
        !['IN_REVIEW', 'APPROVED'].includes(job.reminder.deliverable.status)
      ) {
        await this.finish(id, claimToken, 'PENDING', {
          nextAttemptAt: new Date(now.getTime() + 3600000),
          lastErrorCode: 'AWAITING_VALID_DELIVERY',
          attempts: { decrement: 1 },
        });
        return;
      }
      const base = new URL(
        this.config.get<string>('PUBLIC_FRONTEND_URL') ||
          'http://localhost:5173',
      );
      if (
        !['http:', 'https:'].includes(base.protocol) ||
        base.username ||
        base.password
      )
        throw new Error('Invalid frontend base');
      const link = new URL(
        job.audience === 'CLIENT'
          ? '/client/quotes/' + v.quoteId + '/agreement'
          : '/admin/quotes',
        base,
      ).href;
      const deadline = new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(job.reminder.dueAt);
      const text =
        'Recordatorio de pago de la cuota ' +
        s.sequence +
        '. Vencimiento: ' +
        deadline +
        ' (America/Lima). Saldo: ' +
        v.currency +
        ' ' +
        ((Number(s.amountMinor) - paid) / 100).toFixed(2) +
        '. Consulta el estado actualizado: ' +
        link;
      const result = await this.mail.send({
        recipient: job.user.email,
        subject: 'TISNET · recordatorio de pago',
        text,
        html: '<p>' + escapeHtml(text) + '</p>',
        idempotencyKey: 'payment-reminder-delivery-' + id,
      });
      await this.finish(id, claimToken, 'SENT', {
        sentAt: new Date(),
        messageId: result.messageId.slice(0, 255),
        lastErrorCode: null,
      });
    } catch {
      const job = await this.db.paymentReminderDelivery.findUnique({
        where: { id },
        select: { attempts: true },
      });
      const attempts = job?.attempts || 1;
      await this.finish(id, claimToken, attempts >= 5 ? 'FAILED' : 'PENDING', {
        nextAttemptAt: new Date(
          now.getTime() + Math.min(3600000, 60000 * 2 ** attempts),
        ),
        lastErrorCode: 'DELIVERY_FAILED',
      });
    }
  }
  private async finish(
    id: number,
    claimToken: string,
    status: string,
    data: Prisma.PaymentReminderDeliveryUpdateManyMutationInput,
  ) {
    await this.db.$transaction(async (tx) => {
      const updated = await tx.paymentReminderDelivery.updateMany({
        where: { id, claimToken, status: 'SENDING' },
        data: { ...data, status, leaseUntil: null, claimToken: null },
      });
      if (updated.count)
        await auditRecord(tx, {
          action: 'PAYMENT_REMINDER_' + status,
          entityType: 'PAYMENT_REMINDER_DELIVERY',
          entityId: String(id),
        });
    });
  }
  async list(quoteId: number, clientId?: number) {
    return this.db.paymentReminder.findMany({
      where: { schedule: { quoteVersion: { quoteId } } },
      select: {
        id: true,
        scheduleId: true,
        deliverableId: true,
        trigger: true,
        occurredAt: true,
        dueAt: true,
        calendarVersion: true,
        cutoff: true,
        deliveries: {
          where: clientId ? { userId: clientId } : {},
          select: {
            id: true,
            audience: true,
            status: true,
            attempts: true,
            sentAt: true,
            nextAttemptAt: true,
            lastErrorCode: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }
  async retry(id: number, actorId: number) {
    return this.db.$transaction(async (tx) => {
      const job = await tx.paymentReminderDelivery.findUnique({
        where: { id },
      });
      if (!job) throw new NotFoundException('Envío no encontrado.');
      const result = await tx.paymentReminderDelivery.updateMany({
        where: { id, status: 'FAILED' },
        data: {
          status: 'PENDING',
          attempts: 0,
          nextAttemptAt: new Date(),
          leaseUntil: null,
          claimToken: null,
        },
      });
      if (!result.count)
        throw new ConflictException('Solo se reintentan envíos fallidos.');
      await auditRecord(tx, {
        actorId,
        action: 'PAYMENT_REMINDER_RETRIED',
        entityType: 'PAYMENT_REMINDER_DELIVERY',
        entityId: String(id),
      });
      return { queued: true };
    });
  }
}
