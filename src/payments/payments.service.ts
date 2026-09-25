import { auditRecord } from '../audit/audit.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OfficialQuoteDto, PaymentEventDto } from './payments.dto';
export function allocateInstallments(
  total: number,
  installments: OfficialQuoteDto['installments'],
) {
  if (
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    installments.length < 1 ||
    installments.length > 5 ||
    installments.some(
      (x) =>
        !Number.isInteger(x.percentageBasisPoints) ||
        x.percentageBasisPoints <= 0 ||
        x.percentageBasisPoints > 10000,
    ) ||
    installments.reduce((sum, x) => sum + x.percentageBasisPoints, 0) !== 10000
  )
    throw new BadRequestException(
      'Se requieren de 1 a 5 cuotas que sumen exactamente 10000 puntos base (100%).',
    );
  let allocated = 0;
  return installments.map((x, i) => {
    const amount =
      i === installments.length - 1
        ? total - allocated
        : Number((BigInt(total) * BigInt(x.percentageBasisPoints)) / 10000n);
    if (amount <= 0)
      throw new BadRequestException(
        'Cada cuota debe tener un importe positivo.',
      );
    if (!Number.isFinite(Date.parse(x.dueDate)) || !x.milestone.trim())
      throw new BadRequestException('Fecha e hito obligatorios.');
    if (i && Date.parse(x.dueDate) < Date.parse(installments[i - 1].dueDate))
      throw new BadRequestException(
        'Las fechas de las cuotas deben estar ordenadas.',
      );
    allocated += amount;
    return {
      sequence: i + 1,
      percentageBasisPoints: x.percentageBasisPoints,
      amountMinor: amount,
      dueDate: new Date(x.dueDate),
      milestone: x.milestone.trim(),
    };
  });
}
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}
  async officialize(id: number, authorId: number, dto: OfficialQuoteDto) {
    const schedules = allocateInstallments(dto.amountMinor, dto.installments);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Quote WHERE id = ${id} FOR UPDATE`;
      const quote = await tx.quote.findUnique({
        where: { id },
        include: { prospect: true },
      });
      if (!quote) throw new NotFoundException('Cotización no encontrada');
      const client = await tx.user.findFirst({
        where: {
          id: dto.clientUserId,
          isActive: true,
          role: { name: 'CLIENT' },
        },
      });
      if (
        !client ||
        client.email.toLowerCase() !== quote.contactEmail.toLowerCase() ||
        (quote.prospect?.userId && quote.prospect.userId !== client.id)
      )
        throw new BadRequestException(
          'El cliente debe coincidir con el contacto y prospecto de la cotización.',
        );
      if (
        await tx.payment.count({
          where: {
            status: 'CONFIRMED',
            schedule: { quoteVersion: { quoteId: id } },
          },
        })
      )
        throw new ConflictException(
          'Una cotización con pagos confirmados no puede sustituirse.',
        );
      if (!quote.prospectId)
        throw new ConflictException('La cotización requiere prospecto.');
      await tx.prospect.update({
        where: { id: quote.prospectId },
        data: { userId: client.id },
      });
      const version = await tx.quoteVersion.create({
        data: {
          quoteId: id,
          version: quote.activeVersion + 1,
          clientUserId: client.id,
          authorId,
          observations: dto.observations,
          amountMinor: dto.amountMinor,
          currency: dto.currency,
          scope: { description: dto.scope },
          schedules: { create: schedules },
        },
        include: { schedules: { orderBy: { sequence: 'asc' } } },
      });
      await tx.quote.update({
        where: { id },
        data: { activeVersion: version.version },
      });
      await auditRecord(tx, {
        actorId: authorId,
        action: 'QUOTE_OFFICIALIZED',
        entityType: 'QUOTE',
        entityId: String(id),
        metadata: { version: version.version },
      });
      return version;
    });
  }
  versions(quoteId: number) {
    return this.prisma.quoteVersion.findMany({
      where: { quoteId },
      orderBy: { version: 'desc' },
      include: {
        schedules: {
          orderBy: { sequence: 'asc' },
          include: { payments: true },
        },
      },
    });
  }
  // Domain boundary for B: call only AFTER verifying the provider signature and event origin.
  async processEvent(dto: PaymentEventDto, actorId?: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const schedule = await tx.paymentSchedule.findUnique({
          where: { id: dto.scheduleId },
          include: { quoteVersion: true },
        });
        if (!schedule) throw new NotFoundException('Cuota no encontrada');
        await tx.$queryRaw`SELECT id FROM Quote WHERE id = ${schedule.quoteVersion.quoteId} FOR UPDATE`;
        const existing = await tx.payment.findUnique({
          where: { externalEventId: dto.externalEventId },
        });
        if (existing) {
          if (
            existing.scheduleId !== dto.scheduleId ||
            Number(existing.amountMinor) !== dto.amountMinor ||
            existing.currency !== dto.currency ||
            existing.status !== dto.status
          )
            throw new ConflictException(
              'El identificador del evento ya tiene otro contenido.',
            );
          return existing;
        }
        const quote = await tx.quote.findUniqueOrThrow({
          where: { id: schedule.quoteVersion.quoteId },
        });
        if (quote.activeVersion !== schedule.quoteVersion.version)
          throw new ConflictException(
            'La cuota corresponde a una versión sustituida.',
          );
        if (
          Number(schedule.amountMinor) !== dto.amountMinor ||
          schedule.quoteVersion.currency !== dto.currency
        )
          throw new BadRequestException(
            'Importe o moneda no coincide con la cuota.',
          );
        if (
          dto.status === 'CONFIRMED' &&
          (await tx.payment.count({
            where: { scheduleId: dto.scheduleId, status: 'CONFIRMED' },
          }))
        )
          throw new ConflictException('La cuota ya fue pagada.');
        const payment = await tx.payment.create({ data: dto });
        await auditRecord(tx, {
          actorId,
          action: 'PAYMENT_' + dto.status,
          entityType: 'PAYMENT',
          entityId: String(payment.id),
          metadata: { scheduleId: dto.scheduleId, status: dto.status },
        });
        return payment;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Evento de pago duplicado.');
      throw error;
    }
  }
  async assertInitialPayment(
    quoteId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const quote = await tx.quote.findUnique({ where: { id: quoteId } });
    if (!quote?.activeVersion)
      throw new ConflictException('Se requiere cotización oficial.');
    const initial = await tx.paymentSchedule.findFirst({
      where: {
        sequence: 1,
        quoteVersion: { quoteId, version: quote.activeVersion },
      },
      include: {
        payments: { where: { status: 'CONFIRMED' } },
        quoteVersion: true,
      },
    });
    if (!initial?.payments.length)
      throw new ConflictException(
        'El pago inicial debe estar confirmado antes de iniciar el proyecto.',
      );
    return initial.quoteVersion;
  }
}
