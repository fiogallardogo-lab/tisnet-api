import { BadRequestException, Injectable } from '@nestjs/common';
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
  ]) {
    const v = value[key];
    if (
      (typeof v === 'number' && Number.isFinite(v)) ||
      typeof v === 'boolean' ||
      (typeof v === 'string' && /^[A-Z_]+$/.test(v) && v.length <= 40)
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
@Injectable()
export class AuditService {
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
}
export function csvCell(value: unknown) {
  let text = String(value);
  if (/^[=+\-@\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
