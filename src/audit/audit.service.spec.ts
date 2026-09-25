import { beforeEach, describe, expect, it } from 'vitest';
import { AuditService } from './audit.service';
import { InMemoryAuditProvider } from './in-memory-audit.provider';

describe('AuditService', () => {
  let service: AuditService;
  let provider: InMemoryAuditProvider;

  beforeEach(() => {
    provider = new InMemoryAuditProvider();
    service = new AuditService(provider);
  });

  it('logs a payment event with appropriate severity', async () => {
    const successEvent = await service.logPaymentEvent({
      paymentId: 'chr_123',
      amount: 15000,
      currency: 'PEN',
      status: 'SUCCEEDED',
      email: 'client@example.com',
    });

    expect(successEvent.action).toBe('PAYMENT_SUCCEEDED');
    expect(successEvent.severity).toBe('INFO');
    expect(successEvent.metadata?.amount).toBe(15000);

    const failEvent = await service.logPaymentEvent({
      paymentId: 'chr_456',
      amount: 5000,
      currency: 'PEN',
      status: 'FAILED',
    });

    expect(failEvent.action).toBe('PAYMENT_FAILED');
    expect(failEvent.severity).toBe('WARN');
  });

  it('logs quote status transitions', async () => {
    const event = await service.logQuoteStatusChange({
      quoteId: 42,
      publicCode: 'QT-2026-0042',
      fromStatus: 'PENDING',
      toStatus: 'APPROVED',
      actorEmail: 'sales@tisnet.pe',
    });

    expect(event.action).toBe('QUOTE_STATUS_CHANGED');
    expect(event.previousState).toEqual({ status: 'PENDING' });
    expect(event.newState).toEqual({ status: 'APPROVED' });
  });

  it('logs authentication and security events', async () => {
    const resetEvent = await service.logAuthEvent({
      action: 'PASSWORD_RESET_SUCCESS',
      email: 'user@tisnet.pe',
      userId: 5,
    });

    expect(resetEvent.action).toBe('PASSWORD_RESET_SUCCESS');
    expect(resetEvent.severity).toBe('SECURITY');
    expect(resetEvent.actorId).toBe(5);
  });
});
