import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AUDIT_PROVIDER,
  AuditEvent,
  AuditProvider,
  AuditQueryFilters,
  AuditQueryResult,
  CreateAuditEventInput,
} from './audit-provider.interface';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(AUDIT_PROVIDER)
    private readonly auditProvider: AuditProvider,
  ) {}

  /**
   * General record method
   */
  async record(input: CreateAuditEventInput): Promise<AuditEvent> {
    try {
      return await this.auditProvider.record(input);
    } catch (err: any) {
      // Audit recording should never crash the main transaction
      this.logger.error(`Failed to record audit event: ${err.message}`, err.stack);
      return {
        id: 'aud_fallback',
        action: input.action,
        entityType: input.entityType,
        entityId: String(input.entityId),
        severity: input.severity ?? 'ERROR',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Query audit events
   */
  async query(filters: AuditQueryFilters): Promise<AuditQueryResult> {
    return this.auditProvider.query(filters);
  }

  /**
   * Get entity history
   */
  async getEntityHistory(
    entityType: string,
    entityId: string | number,
  ): Promise<AuditEvent[]> {
    return this.auditProvider.getEntityHistory(entityType, entityId);
  }

  /**
   * Dedicated helper for payment transactions
   */
  async logPaymentEvent(opts: {
    paymentId: string;
    amount: number;
    currency: string;
    status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
    email?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditEvent> {
    return this.record({
      action: `PAYMENT_${opts.status}`,
      entityType: 'Payment',
      entityId: opts.paymentId,
      actorEmail: opts.email,
      severity: opts.status === 'FAILED' ? 'WARN' : 'INFO',
      metadata: {
        amount: opts.amount,
        currency: opts.currency,
        status: opts.status,
        ...(opts.metadata ?? {}),
      },
    });
  }

  /**
   * Dedicated helper for quote lifecycle
   */
  async logQuoteStatusChange(opts: {
    quoteId: number | string;
    publicCode: string;
    fromStatus: string;
    toStatus: string;
    actorId?: number;
    actorEmail?: string;
  }): Promise<AuditEvent> {
    return this.record({
      action: 'QUOTE_STATUS_CHANGED',
      entityType: 'Quote',
      entityId: opts.quoteId,
      actorId: opts.actorId,
      actorEmail: opts.actorEmail,
      previousState: { status: opts.fromStatus },
      newState: { status: opts.toStatus },
      metadata: { publicCode: opts.publicCode },
    });
  }

  /**
   * Dedicated helper for auth & security events
   */
  async logAuthEvent(opts: {
    action:
      | 'LOGIN_SUCCESS'
      | 'LOGIN_FAILED'
      | 'PASSWORD_RESET_REQUESTED'
      | 'PASSWORD_RESET_SUCCESS'
      | 'LOGOUT';
    email: string;
    userId?: number;
    ipAddress?: string;
  }): Promise<AuditEvent> {
    const isSecurity =
      opts.action === 'PASSWORD_RESET_SUCCESS' || opts.action === 'LOGIN_FAILED';

    return this.record({
      action: opts.action,
      entityType: 'User',
      entityId: opts.userId ?? opts.email,
      actorId: opts.userId,
      actorEmail: opts.email,
      ipAddress: opts.ipAddress,
      severity: isSecurity ? 'SECURITY' : 'INFO',
    });
  }
}
