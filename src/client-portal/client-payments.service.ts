import {
  ConflictException,
  ServiceUnavailableException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from '../payments/payment-provider.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class ClientPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  async listMine(actor: { id: number }) {
    const schedules = await this.prisma.paymentSchedule.findMany({
      where: {
        quoteVersion: {
          acceptedAt: { not: null },
          quote: { prospect: { userId: actor.id } },
        },
      },
      include: {
        quoteVersion: {
          include: {
            quote: { select: { id: true, publicCode: true, activeVersion: true } },
          },
        },
        payments: {
          where: { status: 'CONFIRMED' },
          orderBy: { createdAt: 'desc' },
        },
        manualPaymentSubmissions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true,
            operationNumber: true,
            paymentMethod: true,
            paidAt: true,
            reviewNote: true,
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
    });

    const now = new Date();
    return schedules
      .filter((schedule) => schedule.quoteVersion.version === schedule.quoteVersion.quote.activeVersion)
      .map((schedule) => {
        const paidMinor = schedule.payments.reduce(
          (sum, payment) => sum + Number(payment.amountMinor),
          0,
        );
        const submission = schedule.manualPaymentSubmissions[0] ?? null;
        const status =
          paidMinor >= Number(schedule.amountMinor)
            ? 'PAID'
            : paidMinor > 0
              ? 'PARTIAL'
              : submission?.status === 'SUBMITTED'
                ? 'UNDER_REVIEW'
                : submission?.status === 'REJECTED'
                  ? 'REJECTED'
                  : schedule.dueDate < now
                    ? 'OVERDUE'
                    : 'PENDING';
        return {
          id: schedule.id,
          quoteId: schedule.quoteVersion.quote.id,
          quoteCode: schedule.quoteVersion.quote.publicCode,
          installment: schedule.milestone,
          sequence: schedule.sequence,
          amountMinor: Number(schedule.amountMinor),
          paidMinor,
          currency: schedule.quoteVersion.currency,
          dueDate: schedule.dueDate,
          paidAt: schedule.payments[0]?.createdAt ?? submission?.paidAt ?? null,
          status,
          operationNumber: submission?.operationNumber ?? null,
          paymentMethod: submission?.paymentMethod ?? null,
          reviewNote: submission?.status === 'REJECTED' ? submission.reviewNote : null,
        };
      });
  }

  private async payableSchedule(
    installmentId: number,
    actor: { id: number; email: string },
  ) {
    const schedule = await this.prisma.paymentSchedule.findUnique({
      where: { id: installmentId },
      include: {
        quoteVersion: {
          include: {
            quote: {
              include: { prospect: true },
            },
            client: true,
          },
        },
        payments: { where: { status: 'CONFIRMED' } },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Cuota no encontrada.');
    }

    const { quoteVersion } = schedule;
    if (quoteVersion.quote.prospect?.userId !== actor.id) {
      throw new ForbiddenException('No tienes acceso a esta cuota.');
    }

    if (
      schedule.payments.length > 0 &&
      schedule.payments.reduce((a, b) => a + Number(b.amountMinor), 0) >=
        Number(schedule.amountMinor)
    ) {
      throw new ConflictException('Esta cuota ya se encuentra pagada.');
    }

    if (
      !quoteVersion.acceptedAt ||
      quoteVersion.quote.activeVersion !== quoteVersion.version
    ) {
      throw new ConflictException(
        'Acepta la versión oficial vigente antes de pagar.',
      );
    }
    const unpaidPrevious = await this.prisma.paymentSchedule.findFirst({
      where: {
        quoteVersionId: schedule.quoteVersionId,
        sequence: { lt: schedule.sequence },
        payments: { none: { status: 'CONFIRMED' } },
      },
      select: { milestone: true },
    });
    if (unpaidPrevious) {
      throw new ConflictException(
        `Completa primero el pago de ${unpaidPrevious.milestone}.`,
      );
    }
    if (!['PEN', 'USD'].includes(quoteVersion.currency)) {
      throw new BadRequestException('Moneda de pago no soportada.');
    }
    return schedule;
  }

  private requireCulqi() {
    if (
      this.config.get('CULQI_ENABLED') !== 'true' ||
      this.config.get('PAYMENT_DRIVER') !== 'culqi' ||
      !this.config.get<string>('CULQI_SECRET_KEY')?.trim() ||
      !this.config.get<string>('CULQI_PUBLIC_KEY')?.trim() ||
      !this.config.get<string>('CULQI_WEBHOOK_BASIC_AUTH')?.trim()
    ) {
      throw new ServiceUnavailableException(
        'Los pagos todavía no están habilitados.',
      );
    }
  }

  async createCharge(
    installmentId: number,
    actor: { id: number; email: string },
    tokenId: string,
  ) {
    const schedule = await this.payableSchedule(installmentId, actor);
    this.requireCulqi();
    const paid = schedule.payments.reduce(
      (sum, payment) => sum + Number(payment.amountMinor),
      0,
    );
    const charge = await this.paymentProvider.createCharge({
      amount: Number(schedule.amountMinor) - paid,
      currency: schedule.quoteVersion.currency as 'PEN' | 'USD',
      tokenId,
      email: actor.email,
      description: 'Pago cuota ' + schedule.sequence,
      metadata: { scheduleId: schedule.id },
    });
    // Financial state changes only through the authenticated provider webhook.
    return { chargeId: charge.id, status: 'PENDING_CONFIRMATION' };
  }

  async createCheckout(
    installmentId: number,
    actor: { id: number; email: string },
  ) {
    const schedule = await this.payableSchedule(installmentId, actor);
    this.requireCulqi();
    const { quoteVersion } = schedule;
    const orderNumber = `ORD-${schedule.id}-${Date.now()}`;
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 48); // 48 hours to pay CIP

    const order = await this.paymentProvider.createOrder({
      amount:
        Number(schedule.amountMinor) -
        schedule.payments.reduce(
          (sum, payment) => sum + Number(payment.amountMinor),
          0,
        ),
      currency: quoteVersion.currency as 'PEN' | 'USD',
      description: `Pago Cuota ${schedule.sequence}: ${schedule.milestone} (${quoteVersion.quote.publicCode})`,
      orderNumber,
      expirationDate,
      clientDetails: {
        firstName: quoteVersion.quote.contactName,
        lastName: '',
        email: quoteVersion.quote.contactEmail || actor.email,
        phone: quoteVersion.quote.contactPhone,
      },
      metadata: {
        scheduleId: schedule.id,
      },
    });

    const frontendBaseUrl = (
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:5173'
    ).replace(/\/+$/, '');
    const checkoutUrl =
      order.qrCode ||
      `${frontendBaseUrl}/client/quotes/${quoteVersion.quote.id}/agreement?checkoutOrder=${order.id}&code=${order.paymentCode ?? ''}`;

    return {
      orderId: order.id,
      paymentCode: order.paymentCode,
      qrCode: order.qrCode,
      amountMinor: order.amount,
      currency: order.currency,
      expirationDate: order.expirationDate,
      checkoutUrl,
    };
  }
}
