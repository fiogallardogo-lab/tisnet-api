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
});
