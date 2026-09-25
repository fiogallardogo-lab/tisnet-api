import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQuery } from './audit.dto';

// Strict allowlist. Do not recursively store caller-provided bodies, URLs or headers.
export function safeAuditMetadata(value: Record<string, unknown> = {}) {
  const safe: Record<string, string | number | boolean> = {};
  for (const key of [
    'method',
    'status',
    'version',
    'quoteId',
    'scheduleId',
    'memberCount',
    'count',
    'amount',
    'currency',
    'remainingBusinessDays',
    'deadline',
    'role',
    'resultingUserId',
    'fileType',
  ]) {
    const v = value[key];
    if (
      (typeof v === 'number' && Number.isFinite(v)) ||
      typeof v === 'boolean' ||
      (typeof v === 'string' && /^[A-Za-z0-9_\-\.:]+$/.test(v) && v.length <= 80)
    )
      safe[key] = v as string | number | boolean;
  }
  return safe;
}

export function auditRecord(
  tx: Prisma.TransactionClient,
  input: {
    actorId?: number;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  },
) {
  return tx.auditEvent.create({
    data: { ...input, metadata: safeAuditMetadata(input.metadata) },
  });
}

export function csvCell(value: unknown) {
  let text = String(value);
  if (/^[=+\-@\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  private where(query: AuditQuery): Prisma.AuditEventWhereInput {
    const from = query.from
        ? new Date(query.from)
        : new Date(Date.now() - 30 * 86400000),
      to = query.to ? new Date(query.to) : new Date();
    if (from > to || to.getTime() - from.getTime() > 366 * 86400000)
      throw new BadRequestException(
        'El rango de auditoría debe ser de hasta 366 días.',
      );
    return {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      createdAt: { gte: from, lte: to },
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    };
  }

  async list(query: AuditQuery) {
    const rows = await this.prisma.auditEvent.findMany({
      where: this.where(query),
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return { items, nextCursor: hasMore ? items.at(-1)?.id : null };
  }

  async report(query: AuditQuery) {
    return this.prisma.auditEvent.groupBy({
      by: ['entityType', 'action'],
      where: this.where(query),
      _count: { _all: true },
      orderBy: [{ entityType: 'asc' }, { action: 'asc' }],
    });
  }

  async export(query: AuditQuery) {
    const result = await this.list(query);
    const lines = [
      'id,actor,action,entityType,entityId,timestamp',
      ...result.items.map((e) =>
        [
          e.id,
          e.actorId ?? '',
          e.action,
          e.entityType,
          e.entityId,
          e.createdAt.toISOString(),
        ]
          .map(csvCell)
          .join(','),
      ),
    ];
    return { content: lines.join('\r\n'), nextCursor: result.nextCursor };
  }

  financialSummary() {
    return this.prisma.payment.groupBy({
      by: ['currency', 'status'],
      _sum: { amountMinor: true },
      _count: { _all: true },
    });
  }

  /**
   * Helper method for recording arbitrary audit events into database
   */
  async record(input: {
    actorId?: number;
    actorEmail?: string;
    action: string;
    entityType: string;
    entityId: string | number;
    severity?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      return await this.prisma.auditEvent.create({
        data: {
          actorId: input.actorId,
          action: input.action,
          entityType: input.entityType,
          entityId: String(input.entityId),
          metadata: safeAuditMetadata(input.metadata),
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to record audit event: ${err.message}`);
      return null as any;
    }
  }

  async logPaymentEvent(opts: {
    paymentId: string;
    amount: number;
    currency: string;
    status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
    email?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.record({
      action: `PAYMENT_${opts.status}`,
      entityType: 'Payment',
      entityId: opts.paymentId,
      metadata: {
        status: opts.status,
        amount: opts.amount,
        currency: opts.currency,
        ...(opts.metadata ?? {}),
      },
    });
  }

  async logQuoteStatusChange(opts: {
    quoteId: number | string;
    publicCode: string;
    fromStatus: string;
    toStatus: string;
    actorId?: number;
    actorEmail?: string;
  }) {
    return this.record({
      action: 'QUOTE_STATUS_CHANGED',
      entityType: 'Quote',
      entityId: opts.quoteId,
      actorId: opts.actorId,
      actorEmail: opts.actorEmail,
      metadata: { status: opts.toStatus, quoteId: opts.publicCode },
    });
  }

  async logAuthEvent(opts: {
    action: string;
    email: string;
    userId?: number;
  }) {
    return this.record({
      action: opts.action,
      entityType: 'User',
      entityId: String(opts.userId ?? opts.email),
      actorId: opts.userId,
      actorEmail: opts.email,
    });
  }
}
