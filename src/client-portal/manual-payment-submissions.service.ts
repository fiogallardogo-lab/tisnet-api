import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage-provider.interface';
import { auditRecord } from '../audit/audit.service';

export type ManualReceiptUpload = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

export type ManualPaymentInput = {
  operationNumber: string;
  paymentMethod: string;
  paidAt: string;
  notes?: string;
};

const paymentMethods = new Set(['BANK_TRANSFER', 'YAPE', 'PLIN']);

@Injectable()
export class ManualPaymentSubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private validateFile(file?: ManualReceiptUpload) {
    if (
      !file ||
      !Buffer.isBuffer(file.buffer) ||
      file.size < 1 ||
      file.size > 5 * 1024 * 1024
    )
      throw new BadRequestException('Adjunta un comprobante de hasta 5 MiB.');
    const isPdf =
      file.mimetype === 'application/pdf' &&
      file.buffer.subarray(0, 5).toString() === '%PDF-';
    const isPng =
      file.mimetype === 'image/png' &&
      file.buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg =
      file.mimetype === 'image/jpeg' &&
      file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    if (!isPdf && !isPng && !isJpeg)
      throw new BadRequestException(
        'El comprobante debe ser PDF, PNG o JPG válido.',
      );
    return file.mimetype;
  }

  async submit(
    scheduleId: number,
    actor: { id: number },
    input: ManualPaymentInput,
    file?: ManualReceiptUpload,
  ) {
    const mimeType = this.validateFile(file);
    const operationNumber = input.operationNumber?.trim();
    const paidAt = new Date(input.paidAt);
    if (!operationNumber || operationNumber.length > 100)
      throw new BadRequestException('Indica un número de operación válido.');
    if (!paymentMethods.has(input.paymentMethod))
      throw new BadRequestException('El método de pago no es válido.');
    if (
      !Number.isFinite(paidAt.getTime()) ||
      paidAt.getTime() > Date.now() + 5 * 60_000
    )
      throw new BadRequestException('Indica una fecha de pago válida.');
    if (input.notes && input.notes.length > 1000)
      throw new BadRequestException(
        'Las notas no pueden superar 1000 caracteres.',
      );

    const schedule = await this.prisma.paymentSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        quoteVersion: { include: { quote: { include: { prospect: true } } } },
        payments: { where: { status: 'CONFIRMED' } },
      },
    });
    if (!schedule) throw new NotFoundException('Cuota no encontrada.');
    const { quoteVersion } = schedule;
    if (quoteVersion.quote.prospect?.userId !== actor.id)
      throw new ForbiddenException('No tienes acceso a esta cuota.');
    if (
      !quoteVersion.acceptedAt ||
      quoteVersion.quote.activeVersion !== quoteVersion.version
    )
      throw new ConflictException(
        'Acepta la versión oficial vigente antes de enviar el comprobante.',
      );
    if (schedule.payments.length)
      throw new ConflictException('Esta cuota ya tiene un pago registrado.');
    const unpaidPrevious = await this.prisma.paymentSchedule.findFirst({
      where: {
        quoteVersionId: schedule.quoteVersionId,
        sequence: { lt: schedule.sequence },
        payments: { none: { status: 'CONFIRMED' } },
      },
      select: { milestone: true },
    });
    if (unpaidPrevious)
      throw new ConflictException(
        `Completa primero el pago de ${unpaidPrevious.milestone}.`,
      );

    const fileExtension =
      mimeType === 'application/pdf'
        ? 'pdf'
        : mimeType === 'image/png'
          ? 'png'
          : 'jpg';
    const storageKey = `payment-receipts/${randomUUID()}.${fileExtension}`;
    const storedFile = await this.storage.save({
      key: storageKey,
      content: file!.buffer,
      mimeType,
    });
    try {
      const submission = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM PaymentSchedule WHERE id = ${scheduleId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM Quote WHERE id = ${quoteVersion.quote.id} FOR UPDATE`;
        const current = await tx.paymentSchedule.findUnique({
          where: { id: scheduleId },
          include: {
            quoteVersion: {
              include: { quote: { include: { prospect: true } } },
            },
            payments: { where: { status: 'CONFIRMED' } },
          },
        });
        if (!current) throw new NotFoundException('Cuota no encontrada.');
        if (current.quoteVersion.quote.prospect?.userId !== actor.id)
          throw new ForbiddenException('No tienes acceso a esta cuota.');
        if (
          !current.quoteVersion.acceptedAt ||
          current.quoteVersion.quote.activeVersion !==
            current.quoteVersion.version
        )
          throw new ConflictException(
            'Acepta la versión oficial vigente antes de enviar el comprobante.',
          );
        if (current.payments.length)
          throw new ConflictException(
            'Esta cuota ya tiene un pago registrado.',
          );
        const pending = await tx.manualPaymentSubmission.findFirst({
          where: { scheduleId, status: 'SUBMITTED' },
          select: { id: true },
        });
        if (pending)
          throw new ConflictException(
            'Ya existe un comprobante pendiente de revisión para esta cuota.',
          );
        const created = await tx.manualPaymentSubmission.create({
          data: {
            scheduleId,
            clientUserId: actor.id,
            operationNumber,
            paymentMethod: input.paymentMethod,
            paidAt,
            amountMinor: current.amountMinor,
            currency: current.quoteVersion.currency,
            storageKey: storedFile.storageKey,
            receiptName:
              file!.originalname
                .replace(/[^a-zA-Z0-9._ -]/g, '_')
                .slice(0, 255) || `comprobante.${fileExtension}`,
            mimeType,
            notes: input.notes?.trim() || null,
          },
        });
        await auditRecord(tx, {
          actorId: actor.id,
          action: 'MANUAL_PAYMENT_SUBMITTED',
          entityType: 'MANUAL_PAYMENT_SUBMISSION',
          entityId: String(created.id),
          metadata: {
            scheduleId,
            status: 'SUBMITTED',
            currency: current.quoteVersion.currency,
          },
        });
        return created;
      });
      return { id: submission.id, status: submission.status };
    } catch (error) {
      await this.storage.delete(storedFile.storageKey).catch(() => undefined);
      throw error;
    }
  }

  async listPending() {
    const items = await this.prisma.manualPaymentSubmission.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { createdAt: 'asc' },
      include: { client: true, schedule: true },
    });
    return items.map((item) => ({
      id: item.id,
      status: item.status,
      amountMinor: Number(item.amountMinor),
      currency: item.currency,
      operationNumber: item.operationNumber,
      paymentMethod: item.paymentMethod,
      paidAt: item.paidAt,
      receiptUrl: `/admin/manual-payment-submissions/${item.id}/receipt`,
      receiptName: item.receiptName,
      notes: item.notes,
      client: { name: item.client.name, email: item.client.email },
      installment: { label: item.schedule.milestone },
    }));
  }

  async receipt(id: number) {
    const item = await this.prisma.manualPaymentSubmission.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException('Comprobante no encontrado.');
    const file = await this.storage.get(item.storageKey);
    if (!file)
      throw new NotFoundException(
        'El archivo del comprobante no está disponible.',
      );
    return new StreamableFile(file.content, {
      type: item.mimeType,
      disposition: `attachment; filename="${item.receiptName.replace(/["\\\r\n]/g, '_')}"`,
      length: file.content.length,
    });
  }

  async review(
    id: number,
    reviewerId: number,
    action: 'approve' | 'reject',
    note?: string,
  ) {
    const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ManualPaymentSubmission WHERE id = ${id} FOR UPDATE`;
      const item = await tx.manualPaymentSubmission.findUnique({
        where: { id },
      });
      if (!item) throw new NotFoundException('Comprobante no encontrado.');
      if (item.status !== 'SUBMITTED')
        throw new ConflictException('El comprobante ya fue revisado.');
      if (action === 'approve') {
        await this.payments.processEvent(
          {
            scheduleId: item.scheduleId,
            externalEventId: `manual-submission-${item.id}`,
            amountMinor: Number(item.amountMinor),
            currency: item.currency,
            status: 'CONFIRMED',
          },
          reviewerId,
        );
      }
      await tx.manualPaymentSubmission.update({
        where: { id },
        data: {
          status,
          reviewNote: note?.trim() || null,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      });
      await auditRecord(tx, {
        actorId: reviewerId,
        action: `MANUAL_PAYMENT_${status}`,
        entityType: 'MANUAL_PAYMENT_SUBMISSION',
        entityId: String(id),
        metadata: { scheduleId: item.scheduleId, status },
      });
      return { id, status };
    });
  }
}
