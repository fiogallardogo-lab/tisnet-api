import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeAuditMetadata, csvCell, AuditService } from './audit.service';

describe('Safe audit metadata', () => {
  it('never persists passwords, tokens, nested payloads or arbitrary strings', () => {
    expect(
      safeAuditMetadata({
        password: 'secret',
        passwordHash: 'hash',
        token: 'token',
        authorization: 'Bearer',
        metadata: { secret: 'hidden' },
        status: 'CONFIRMED',
        version: 2,
        method: 'POST',
      }),
    ).toEqual({ status: 'CONFIRMED', version: 2, method: 'POST' });
  });

  it('blocks CSV formula execution and quotes delimiters', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell('a,"b')).toBe('"a,""b"');
  });
});

describe('AuditService helpers', () => {
  let service: AuditService;
  const prismaMock = {
    auditEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuditService(prismaMock as any);
  });

  it('records payment and auth events through Prisma', async () => {
    prismaMock.auditEvent.create.mockResolvedValue({ id: 1 });

    await service.logPaymentEvent({
      paymentId: 'chr_123',
      amount: 15000,
      currency: 'PEN',
      status: 'SUCCEEDED',
      email: 'client@tisnet.pe',
    });

    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PAYMENT_SUCCEEDED',
          entityType: 'Payment',
          entityId: 'chr_123',
        }),
      }),
    );
  });

  describe('list pagination and search', () => {
    const mockEvents = [
      { id: 3, action: 'CREATE' },
      { id: 2, action: 'UPDATE' },
      { id: 1, action: 'DELETE' },
    ];

    beforeEach(() => {
      prismaMock.auditEvent.findMany = vi.fn();
      prismaMock.auditEvent.count = vi.fn();
      (service as any).prisma = {
        $transaction: vi.fn(),
        auditEvent: prismaMock.auditEvent,
      };
    });

    it('uses cursor pagination by default', async () => {
      prismaMock.auditEvent.findMany.mockResolvedValue(mockEvents);

      const result = await service.list({ limit: 2 } as any);

      expect(prismaMock.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe(2);
      expect((result as any).meta).toBeUndefined();
    });

    it('uses offset pagination when page is provided', async () => {
      (service as any).prisma.$transaction.mockResolvedValue([
        mockEvents.slice(0, 2),
        3,
      ]);

      const result = await service.list({ page: 1, limit: 2 } as any);

      expect((service as any).prisma.$transaction).toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
      expect((result as any).nextCursor).toBeUndefined();
      expect(result.meta).toEqual({
        page: 1,
        limit: 2,
        totalItems: 3,
        totalPages: 2,
      });
    });

    it('applies search safely', async () => {
      prismaMock.auditEvent.findMany.mockResolvedValue(mockEvents);

      await service.list({ limit: 10, search: 'TEST' } as any);

      expect(prismaMock.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ action: { contains: 'TEST' } }],
          }),
        }),
      );
    });
  });
});
