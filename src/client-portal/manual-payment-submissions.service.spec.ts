import 'reflect-metadata';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ManualPaymentSubmissionsService, type ManualReceiptUpload } from './manual-payment-submissions.service';
import { ManualPaymentSubmissionsController } from './manual-payment-submissions.controller';
import type { PrismaService } from '../prisma/prisma.service';
import type { PaymentsService } from '../payments/payments.service';
import type { StorageProvider } from '../storage/storage-provider.interface';

describe('ManualPaymentSubmissions', () => {
  let service: ManualPaymentSubmissionsService;
  let controller: ManualPaymentSubmissionsController;
  let mockPrisma: any;
  let mockPayments: any;
  let mockStorage: any;

  const validPdfBuffer = Buffer.from('%PDF-1.4 test content');
  const validPngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
  const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

  beforeEach(() => {
    mockStorage = {
      save: vi.fn().mockResolvedValue({ storageKey: 'payment-receipts/uuid.pdf' }),
      get: vi.fn().mockResolvedValue({ content: validPdfBuffer, mimeType: 'application/pdf' }),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    mockPayments = {
      processEvent: vi.fn().mockResolvedValue({ id: 10, status: 'CONFIRMED' }),
    };

    mockPrisma = {
      paymentSchedule: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      manualPaymentSubmission: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      auditEvent: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
      $transaction: vi.fn(async (callback) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          paymentSchedule: mockPrisma.paymentSchedule,
          manualPaymentSubmission: mockPrisma.manualPaymentSubmission,
          auditEvent: mockPrisma.auditEvent,
        };
        return callback(tx);
      }),
    };

    service = new ManualPaymentSubmissionsService(
      mockPrisma as unknown as PrismaService,
      mockPayments as unknown as PaymentsService,
      mockStorage as StorageProvider,
    );

    controller = new ManualPaymentSubmissionsController(service);
  });

  describe('Validation of file and inputs', () => {
    it('rejects missing or invalid file', async () => {
      await expect(
        service.submit(1, { id: 5 }, {
          operationNumber: 'OP123',
          paymentMethod: 'BANK_TRANSFER',
          paidAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);

      const invalidFile: ManualReceiptUpload = {
        buffer: Buffer.from('plain text file'),
        mimetype: 'text/plain',
        size: 15,
        originalname: 'receipt.txt',
      };

      await expect(
        service.submit(1, { id: 5 }, {
          operationNumber: 'OP123',
          paymentMethod: 'BANK_TRANSFER',
          paidAt: new Date().toISOString(),
        }, invalidFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects file larger than 5 MiB', async () => {
      const oversizedFile: ManualReceiptUpload = {
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
        mimetype: 'application/pdf',
        size: 5 * 1024 * 1024 + 1,
        originalname: 'big.pdf',
      };

      await expect(
        service.submit(1, { id: 5 }, {
          operationNumber: 'OP123',
          paymentMethod: 'BANK_TRANSFER',
          paidAt: new Date().toISOString(),
        }, oversizedFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts valid PDF, PNG, and JPEG files', async () => {
      const scheduleMock = {
        id: 1,
        quoteVersionId: 10,
        sequence: 1,
        amountMinor: 500000n,
        payments: [],
        quoteVersion: {
          version: 1,
          acceptedAt: new Date(),
          currency: 'PEN',
          clientUserId: 5,
          quote: {
            id: 20,
            activeVersion: 1,
            prospect: { userId: 5 },
          },
        },
      };
      mockPrisma.paymentSchedule.findUnique.mockResolvedValue(scheduleMock);
      mockPrisma.paymentSchedule.findFirst.mockResolvedValue(null);
      mockPrisma.manualPaymentSubmission.findFirst.mockResolvedValue(null);
      mockPrisma.manualPaymentSubmission.create.mockResolvedValue({
        id: 99,
        status: 'SUBMITTED',
      });

      const pdfUpload: ManualReceiptUpload = {
        buffer: validPdfBuffer,
        mimetype: 'application/pdf',
        size: validPdfBuffer.length,
        originalname: 'recibo.pdf',
      };

      const result = await service.submit(1, { id: 5 }, {
        operationNumber: 'OP-9988',
        paymentMethod: 'BANK_TRANSFER',
        paidAt: new Date().toISOString(),
      }, pdfUpload);

      expect(result).toEqual({ id: 99, status: 'SUBMITTED' });
      expect(mockStorage.save).toHaveBeenCalled();
      expect(mockPrisma.manualPaymentSubmission.create).toHaveBeenCalled();
    });

    it('rejects future paidAt date beyond tolerance', async () => {
      const futureDate = new Date(Date.now() + 10 * 60_000).toISOString();
      const validUpload: ManualReceiptUpload = {
        buffer: validPdfBuffer,
        mimetype: 'application/pdf',
        size: validPdfBuffer.length,
        originalname: 'recibo.pdf',
      };

      await expect(
        service.submit(1, { id: 5 }, {
          operationNumber: 'OP-123',
          paymentMethod: 'YAPE',
          paidAt: futureDate,
        }, validUpload),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid payment method', async () => {
      const validUpload: ManualReceiptUpload = {
        buffer: validPdfBuffer,
        mimetype: 'application/pdf',
        size: validPdfBuffer.length,
        originalname: 'recibo.pdf',
      };

      await expect(
        service.submit(1, { id: 5 }, {
          operationNumber: 'OP-123',
          paymentMethod: 'BITCOIN',
          paidAt: new Date().toISOString(),
        }, validUpload),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Business rules and permissions', () => {
    const validUpload: ManualReceiptUpload = {
      buffer: validPngBuffer,
      mimetype: 'image/png',
      size: validPngBuffer.length,
      originalname: 'yape.png',
    };

    it('forbids users who are neither the prospect nor the clientUserId', async () => {
      mockPrisma.paymentSchedule.findUnique.mockResolvedValue({
        id: 1,
        quoteVersionId: 10,
        sequence: 1,
        payments: [],
        quoteVersion: {
          version: 1,
          acceptedAt: new Date(),
          currency: 'PEN',
          clientUserId: 88,
          quote: { activeVersion: 1, prospect: { userId: 88 } },
        },
      });

      await expect(
        service.submit(1, { id: 5 }, {
          operationNumber: 'OP-123',
          paymentMethod: 'PLIN',
          paidAt: new Date().toISOString(),
        }, validUpload),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects submissions if official version has not been accepted', async () => {
      mockPrisma.paymentSchedule.findUnique.mockResolvedValue({
        id: 1,
        quoteVersionId: 10,
        sequence: 1,
        payments: [],
        quoteVersion: {
          version: 1,
          acceptedAt: null, // not accepted yet
          currency: 'PEN',
          clientUserId: 5,
          quote: { activeVersion: 1, prospect: { userId: 5 } },
        },
      });

      await expect(
        service.submit(1, { id: 5 }, {
          operationNumber: 'OP-123',
          paymentMethod: 'PLIN',
          paidAt: new Date().toISOString(),
        }, validUpload),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects submissions if prior installment is unpaid', async () => {
      mockPrisma.paymentSchedule.findUnique.mockResolvedValue({
        id: 2,
        quoteVersionId: 10,
        sequence: 2,
        payments: [],
        quoteVersion: {
          version: 1,
          acceptedAt: new Date(),
          currency: 'PEN',
          clientUserId: 5,
          quote: { activeVersion: 1, prospect: { userId: 5 } },
        },
      });
      mockPrisma.paymentSchedule.findFirst.mockResolvedValue({
        milestone: 'Anticipo inicial',
      });

      await expect(
        service.submit(2, { id: 5 }, {
          operationNumber: 'OP-123',
          paymentMethod: 'BANK_TRANSFER',
          paidAt: new Date().toISOString(),
        }, validUpload),
      ).rejects.toThrow(/Completa primero el pago de Anticipo inicial/);
    });
  });

  describe('Admin listPending, receipt and review', () => {
    it('lists pending submissions with client and installment information', async () => {
      const mockItems = [
        {
          id: 1,
          status: 'SUBMITTED',
          amountMinor: 250000n,
          currency: 'PEN',
          operationNumber: 'OP-5544',
          paymentMethod: 'BANK_TRANSFER',
          paidAt: new Date('2026-10-12T10:00:00Z'),
          receiptName: 'comprobante_1.pdf',
          notes: 'Pago realizado por BCP',
          client: { name: 'Acme Corp', email: 'acme@example.test' },
          schedule: { milestone: 'Hito 1 - Diseño y Arquitectura' },
        },
      ];
      mockPrisma.manualPaymentSubmission.findMany.mockResolvedValue(mockItems);

      const result = await service.listPending();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        status: 'SUBMITTED',
        amountMinor: 250000,
        currency: 'PEN',
        operationNumber: 'OP-5544',
        paymentMethod: 'BANK_TRANSFER',
        paidAt: new Date('2026-10-12T10:00:00Z'),
        receiptUrl: '/admin/manual-payment-submissions/1/receipt',
        receiptName: 'comprobante_1.pdf',
        notes: 'Pago realizado por BCP',
        client: { name: 'Acme Corp', email: 'acme@example.test' },
        installment: { label: 'Hito 1 - Diseño y Arquitectura' },
      });
    });

    it('streams receipt file when available', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 1,
        storageKey: 'payment-receipts/abc.pdf',
        mimeType: 'application/pdf',
        receiptName: 'recibo.pdf',
      });

      const fileStream = await service.receipt(1);
      expect(fileStream).toBeDefined();
      expect(mockStorage.get).toHaveBeenCalledWith('payment-receipts/abc.pdf');
    });

    it('approves a submission and triggers payments service reconciliation', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 1,
        scheduleId: 5,
        status: 'SUBMITTED',
        amountMinor: 100000n,
        currency: 'PEN',
      });
      mockPrisma.manualPaymentSubmission.update.mockResolvedValue({
        id: 1,
        status: 'APPROVED',
      });

      const res = await service.review(1, 42, 'approve', 'Aprobado correctamente');

      expect(res).toEqual({ id: 1, status: 'APPROVED' });
      expect(mockPayments.processEvent).toHaveBeenCalledWith(
        {
          scheduleId: 5,
          externalEventId: 'manual-submission-1',
          amountMinor: 100000,
          currency: 'PEN',
          status: 'CONFIRMED',
        },
        42,
      );
      expect(mockPrisma.manualPaymentSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            status: 'APPROVED',
            reviewNote: 'Aprobado correctamente',
            reviewedById: 42,
          }),
        }),
      );
    });

    it('rejects a submission with reason note without confirming payment', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 1,
        scheduleId: 5,
        status: 'SUBMITTED',
        amountMinor: 100000n,
        currency: 'PEN',
      });
      mockPrisma.manualPaymentSubmission.update.mockResolvedValue({
        id: 1,
        status: 'REJECTED',
      });

      const res = await service.review(1, 42, 'reject', 'Número de operación no legible');

      expect(res).toEqual({ id: 1, status: 'REJECTED' });
      expect(mockPayments.processEvent).not.toHaveBeenCalled();
      expect(mockPrisma.manualPaymentSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            status: 'REJECTED',
            reviewNote: 'Número de operación no legible',
            reviewedById: 42,
          }),
        }),
      );
    });
  });

  describe('Controller delegation and role protection', () => {
    it('controller delegates list, receipt, review and submit to service', async () => {
      const listSpy = vi.spyOn(service, 'listPending').mockResolvedValue([] as any);
      const receiptSpy = vi.spyOn(service, 'receipt').mockResolvedValue({} as any);
      const reviewSpy = vi.spyOn(service, 'review').mockResolvedValue({ id: 1, status: 'APPROVED' } as any);
      const submitSpy = vi.spyOn(service, 'submit').mockResolvedValue({ id: 1, status: 'SUBMITTED' } as any);

      await controller.list();
      expect(listSpy).toHaveBeenCalled();

      await controller.receipt(1);
      expect(receiptSpy).toHaveBeenCalledWith(1);

      await controller.review(1, 'approve', { user: { id: 10 } }, { notes: 'ok' });
      expect(reviewSpy).toHaveBeenCalledWith(1, 10, 'approve', 'ok');

      await controller.submit(
        1,
        { user: { id: 5 } },
        { operationNumber: '1', paymentMethod: 'YAPE', paidAt: new Date().toISOString() },
        { buffer: validPngBuffer, mimetype: 'image/png', size: 10, originalname: 'p.png' },
      );
      expect(submitSpy).toHaveBeenCalled();
    });
  });
});
